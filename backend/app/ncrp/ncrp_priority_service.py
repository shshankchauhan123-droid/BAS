import datetime
from decimal import Decimal
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import Counter, defaultdict

from sqlalchemy.orm import Session

from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.ncrp.ncrp_repository import (
    normalize_account_identifier,
    mask_account_number,
    categorize_ncrp_sheet,
)

# ============================================================
# CONFIGURABLE SCORING POLICY & THRESHOLDS (VERSION 1.1)
# ============================================================

SCORING_POLICY_VERSION = "1.1.0"

DEFAULT_PRIORITY_WEIGHTS = {
    "immediate_cash_out": 25.0,
    "unsecured_exposure": 25.0,
    "fund_flow_complexity": 20.0,
    "pattern_indicators": 20.0,
    "investigation_urgency": 10.0,
}

DEFAULT_PRIORITY_THRESHOLDS = {
    "CRITICAL": 75.0,
    "HIGH": 50.0,
    "MEDIUM": 25.0,
    "LOW": 0.0,
}


def parse_clean_amount(val: Any) -> float:
    """Robustly parse numeric, string, decimal, or currency amounts."""
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, Decimal):
        return float(val)
    s = str(val).strip()
    if not s:
        return 0.0
    s = re.sub(r"/-\s*$", "", s)
    s = re.sub(r"(?i)(rs\.?|inr|re\.?|₹)\s*", "", s)
    s = s.replace(",", "").strip()
    cleaned = re.sub(r"[^\d.-]", "", s)
    try:
        return float(cleaned) if cleaned else 0.0
    except Exception:
        return 0.0




def parse_ncrp_datetime_string(val: Any) -> Tuple[Optional[str], Optional[str]]:
    """
    Parses a raw datetime or date value from NCRP worksheets/database into:
    (formatted_date, formatted_datetime).
    Robustly handles datetime/date objects, Excel serial dates (e.g. 45406),
    ISO formats, and common Indian date variations (DD/MM/YYYY, DD-MM-YYYY, etc.).
    Returns (None, None) when genuinely absent or invalid without inventing dates.
    """
    if val is None or val == "":
        return None, None
    s = str(val).strip()
    if s.lower() in {"none", "null", "nan", "nat", "-", "n/a", "not available"}:
        return None, None

    dt_obj = None
    if isinstance(val, datetime.datetime):
        dt_obj = val
    elif isinstance(val, datetime.date):
        dt_obj = datetime.datetime.combine(val, datetime.time.min)
    else:
        # Check numeric Excel serial date
        try:
            num = float(s)
            if 20000 <= num <= 75000:
                excel_base = datetime.datetime(1899, 12, 30)
                dt_obj = excel_base + datetime.timedelta(days=num)
        except (ValueError, TypeError):
            pass

    if dt_obj is None:
        try:
            dt_obj = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            pass

    if dt_obj is None:
        formats = [
            "%d/%m/%Y %I:%M:%S %p",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %I:%M %p",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%d-%m-%Y %I:%M:%S %p",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y %I:%M %p",
            "%d-%m-%Y %H:%M",
            "%d-%m-%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %I:%M:%S %p",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
            "%m/%d/%Y %I:%M:%S %p",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y",
            "%d-%b-%Y",
            "%d-%b-%Y %H:%M:%S",
            "%d-%b-%Y %I:%M:%S %p",
            "%d %b %Y",
        ]
        for fmt in formats:
            try:
                dt_obj = datetime.datetime.strptime(s, fmt)
                break
            except (ValueError, TypeError):
                continue

    if dt_obj is not None:
        date_formatted = dt_obj.strftime("%Y-%m-%d")
        has_time = (dt_obj.hour != 0 or dt_obj.minute != 0 or dt_obj.second != 0)
        # In IST (+05:30), UTC midnight gets stored as 05:30:00. Treat as date-only if hour==5 and min==30
        if dt_obj.tzinfo is not None and dt_obj.hour == 5 and dt_obj.minute == 30 and dt_obj.second == 0:
            dt_formatted = date_formatted
        elif has_time:
            dt_formatted = dt_obj.strftime("%Y-%m-%d %H:%M:%S")
            date_formatted = dt_obj.strftime("%Y-%m-%d %H:%M")
        else:
            dt_formatted = date_formatted
        return date_formatted, dt_formatted

    if len(s) > 0 and len(s) <= 50:
        return s, s

    return None, None

def extract_field(raw: Dict[str, Any], candidate_keys: List[str]) -> Optional[Any]:
    """Extract field from dictionary matching candidate keys case-insensitively with punctuation tolerance."""
    if not raw or not isinstance(raw, dict):
        return None
    for k in candidate_keys:
        if k in raw and raw[k] is not None and str(raw[k]).strip() != "":
            return raw[k]
        norm_target = re.sub(r"[^a-z0-9]", "", k.lower())
        for raw_k, raw_v in raw.items():
            norm_raw_k = re.sub(r"[^a-z0-9]", "", str(raw_k).lower())
            if norm_raw_k == norm_target and raw_v is not None and str(raw_v).strip() != "":
                return raw_v
    return None


def get_ncrp_investigation_priority_report_data(
    db: Session,
    file_id: int,
    case_id: Optional[int] = None,
    weights: Optional[Dict[str, float]] = None,
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Generate comprehensive, dynamic forensic triage data for Report 5: NCRP Investigation Priority Report.
    Audits transactions across all 6 NCRP worksheets, links cross-layer fund-flow DAG,
    computes deduplicated exposure metrics, evaluates 0-100 priority scores,
    pinpoints investigation gaps, and generates evidence-backed recommendations.
    """
    file_obj = db.query(NcrpFile).filter(NcrpFile.id == file_id).first()
    filename = file_obj.original_filename if file_obj else f"File #{file_id}"

    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    active_weights = {**DEFAULT_PRIORITY_WEIGHTS, **(weights or {})}
    active_thresholds = {**DEFAULT_PRIORITY_THRESHOLDS, **(thresholds or {})}

    if not all_txs:
        return _build_empty_priority_report(file_id, case_id or 0, filename, now_iso, active_weights, active_thresholds)

    # ------------------------------------------------------------
    # 1. CANONICAL EVENT BUILDING & RAW EXTRACTION ACROSS 6 SHEETS
    # ------------------------------------------------------------
    canonical_events: List[Dict[str, Any]] = []
    accounts_seen: Set[str] = set()
    banks_seen: Set[str] = set()
    layer1_inflow_sum = 0.0
    layer1_disputed_sum = 0.0
    workbook_ack_no = None

    for _t in all_txs:
        if _t.acknowledgement_no:
            workbook_ack_no = str(_t.acknowledgement_no).strip()
            break
        _raw = _t.raw_data or {}
        _raw_ack = extract_field(_raw, ["Acknowledgement No.", "Acknowledgement No", "Ack No", "Complaint No"])
        if _raw_ack:
            workbook_ack_no = str(_raw_ack).strip()
            break

    # Account and graph relationship trackers
    acc_outgoing_transfers = defaultdict(list)
    acc_inflows = defaultdict(list)
    acc_withdrawals = defaultdict(list)
    acc_layers = defaultdict(set)
    acc_banks = defaultdict(set)
    acc_to_primary_layer = {}

    # Hold tracking (Account and Layer level)
    raw_hold_rows: List[Dict[str, Any]] = []
    seen_hold_fingerprints: Set[Tuple[str, str, str, float]] = set()
    acc_verified_holds = defaultdict(float)
    layer_verified_holds = defaultdict(float)

    # First pass: parse raw events into normalized dictionary
    parsed_raw_events: List[Dict[str, Any]] = []
    seen_tx_fingerprints: Set[Tuple[str, str, str, str, float]] = set()

    for tx in all_txs:
        raw = tx.raw_data or {}
        norm_sheet = (tx.sheet_name or "").lower().strip()

        # Determine event type dynamically
        if "atm" in norm_sheet:
            event_type = "ATM_WITHDRAWAL"
        elif "pos" in norm_sheet:
            event_type = "POS_WITHDRAWAL"
        elif "cheque" in norm_sheet or "check" in norm_sheet:
            event_type = "CHEQUE_WITHDRAWAL"
        elif "hold" in norm_sheet:
            event_type = "HOLD"
        elif "transfer" in norm_sheet or "money transfer" in norm_sheet:
            event_type = "TRANSFER"
        else:
            event_type = "OTHER"

        amt = float(tx.transaction_amount or parse_clean_amount(extract_field(raw, ["Transaction Amount", "Amount", "Withdrawal Amount", "Put on Hold Amount"])))
        disp_amt = float(tx.disputed_amount or parse_clean_amount(extract_field(raw, ["Disputed Amount", "Disputed", "Put on Hold Amount"])))
        if event_type == "HOLD" and disp_amt == 0.0:
            disp_amt = amt

        # Layer extraction
        layer_raw = str(tx.layer or extract_field(raw, ["Layer", "layer", "Hop", "Level"]) or "")
        digits = "".join(c for c in layer_raw if c.isdigit())
        layer_num = int(digits) if digits else 1

        # Account extraction
        primary_acc = normalize_account_identifier(
            tx.account_or_wallet_id or extract_field(raw, ["Account No./ (Wallet /PG/PA) Id", "Account No / Wallet / PG / PA Id", "Account No", "Account/Wallet ID", "Suspect Account No", "Sender Account No", "From Account"])
        )
        dest_acc = normalize_account_identifier(
            extract_field(raw, ["Account No", "Beneficiary Account No", "Target Account", "Receiver Account No"])
        )

        if event_type == "TRANSFER" and primary_acc and dest_acc and primary_acc == dest_acc:
            sender_candidate = normalize_account_identifier(extract_field(raw, ["Sender Account No", "From Account", "Suspect Account No"]))
            if sender_candidate and sender_candidate != dest_acc:
                primary_acc = sender_candidate

        # Bank extraction
        action_bank = extract_field(raw, ["Action Taken By bank", "action_taken_by_bank", "Sender Bank", "Source Bank", "From Bank"])
        beneficiary_bank = extract_field(raw, ["Bank/FIs", "Beneficiary Bank", "Receiver Bank", "Target Bank", "To Bank"])

        if event_type == "TRANSFER":
            source_bank = action_bank or extract_field(raw, ["Bank Name", "Bank"]) or tx.bank_name or "Unknown Bank"
            dest_bank = beneficiary_bank or tx.bank_name or extract_field(raw, ["Bank Name", "Bank"]) or source_bank
        else:
            source_bank = tx.bank_name or action_bank or beneficiary_bank or extract_field(raw, ["Bank Name", "Bank/FIs", "Bank"]) or "Unknown Bank"
            dest_bank = source_bank
        bank_name = str(source_bank).strip()
        dest_bank_name = str(dest_bank).strip()

        # UTR / Reference
        utr = (
            tx.transaction_id_utr
            or extract_field(raw, ["Transaction ID / UTR Number", "Transaction Id / UTR Number", "transfer_utr", "source_utr", "UTR", "Transaction ID", "Reference No"])
        )
        utr = str(utr).strip() if utr else None

        # Date / Time with multi-source fallback and robust parsing
        dt_val = tx.transaction_date
        dt_raw = None
        if tx.raw_data:
            dt_raw = extract_field(raw, [
                "Transaction Date", "Transaction Date & Time", "Transaction Date and Time",
                "Date & Time", "Date and Time", "Date", "Withdrawal Date & Time",
                "Withdrawal Date", "Action Date", "Date of Action", "Put on Hold Date",
                "Entry Date", "Txn Date", "Transfer Date", "Time of Action", "Action Time"
            ])
        d_clean, dt_clean = parse_ncrp_datetime_string(dt_val or dt_raw)
        dt_str = dt_clean or d_clean

        # Ack No
        ack_no = str(tx.acknowledgement_no or extract_field(raw, ["Acknowledgement No.", "Acknowledgement No", "Ack No", "Complaint ID"]) or "").strip() or None

        parsed_raw_events.append({
            "tx_id": tx.id,
            "row_number": tx.row_number,
            "sheet_name": tx.sheet_name,
            "event_type": event_type,
            "primary_acc": primary_acc,
            "dest_acc": dest_acc,
            "bank_name": bank_name,
            "dest_bank_name": dest_bank_name,
            "amount": amt,
            "disputed_amount": disp_amt,
            "layer_num": layer_num,
            "utr": utr,
            "dt_str": dt_str,
            "d_clean": d_clean,
            "ack_no": ack_no,
            "raw": raw,
        })

    # ------------------------------------------------------------
    # 2. FUND-FLOW DAG LAYER RESOLUTION & ACCOUNT REGISTRY
    # ------------------------------------------------------------
    # Pre-calculate Layer 1 totals across all non-hold events
    for pe in parsed_raw_events:
        if pe["layer_num"] == 1 and pe["event_type"] != "HOLD":
            layer1_inflow_sum += pe["amount"]
            layer1_disputed_sum += pe["disputed_amount"]

    # Process transfers to register true layer hierarchy
    for pe in parsed_raw_events:
        if pe["event_type"] == "TRANSFER":
            l_num = pe["layer_num"]
            s_acc = pe["primary_acc"]
            d_acc = pe["dest_acc"]

            if l_num == 1:
                if d_acc:
                    acc_to_primary_layer[d_acc] = 1
                    acc_layers[d_acc].add(1)
                if s_acc and s_acc not in acc_to_primary_layer:
                    acc_to_primary_layer[s_acc] = 1
                    acc_layers[s_acc].add(1)
            else:
                if s_acc:
                    if s_acc not in acc_to_primary_layer:
                        acc_to_primary_layer[s_acc] = max(1, l_num - 1)
                    acc_layers[s_acc].add(l_num - 1)
                if d_acc:
                    if d_acc not in acc_to_primary_layer:
                        acc_to_primary_layer[d_acc] = l_num
                    acc_layers[d_acc].add(l_num)

            if s_acc:
                accounts_seen.add(s_acc)
                acc_banks[s_acc].add(pe["bank_name"])
            if d_acc:
                accounts_seen.add(d_acc)
                acc_banks[d_acc].add(pe["dest_bank_name"])

            if pe["bank_name"] and pe["bank_name"] != "Unknown Bank":
                banks_seen.add(pe["bank_name"])
            if pe["dest_bank_name"] and pe["dest_bank_name"] != "Unknown Bank":
                banks_seen.add(pe["dest_bank_name"])

    # ------------------------------------------------------------
    # 3. VERIFIED HOLD PROCESSING & DEDUPLICATION (ACC & LAYER)
    # ------------------------------------------------------------
    # Process HOLD records from 'Transaction put on hold' worksheet
    for pe in parsed_raw_events:
        if pe["event_type"] == "HOLD":
            hold_acc = pe["primary_acc"] or pe["dest_acc"]
            h_bank = pe["bank_name"]
            h_amt = pe["amount"]
            h_utr = pe["utr"] or ""

            if not hold_acc:
                continue

            # Deduplicate identical hold entries (same account, bank, utr, amount)
            hold_fingerprint = (hold_acc, h_bank, h_utr, h_amt)
            if hold_fingerprint in seen_hold_fingerprints:
                continue
            seen_hold_fingerprints.add(hold_fingerprint)

            # Assign hold layer: from explicit sheet Layer or from DAG account layer
            h_layer = pe["layer_num"]
            if h_layer <= 1 and hold_acc in acc_to_primary_layer:
                h_layer = acc_to_primary_layer[hold_acc]

            acc_verified_holds[hold_acc] += h_amt
            layer_verified_holds[h_layer] += h_amt
            accounts_seen.add(hold_acc)
            acc_layers[hold_acc].add(h_layer)
            if h_bank and h_bank != "Unknown Bank":
                banks_seen.add(h_bank)
                acc_banks[hold_acc].add(h_bank)

            raw_hold_rows.append({
                "account": hold_acc,
                "bank": h_bank,
                "amount": h_amt,
                "layer": h_layer,
                "utr": h_utr,
                "raw": pe["raw"],
                "row_number": pe["row_number"],
            })

    # ------------------------------------------------------------
    # 4. CANONICAL EVENT BUILDING & DATA QUALITY FLAGGING
    # ------------------------------------------------------------
    for pe in parsed_raw_events:
        event_type = pe["event_type"]
        primary_acc = pe["primary_acc"]
        dest_acc = pe["dest_acc"]
        bank_name = pe["bank_name"]
        dest_bank_name = pe["dest_bank_name"]
        amt = pe["amount"]
        disp_amt = pe["disputed_amount"]
        layer_num = pe["layer_num"]
        utr = pe["utr"]
        dt_str = pe["dt_str"]
        raw = pe["raw"]
        tx_id = pe["tx_id"]
        row_number = pe["row_number"]
        sheet_name = pe["sheet_name"]

        # Associate withdrawals with account layer without advancing layer
        effective_acc = primary_acc or dest_acc
        if effective_acc and effective_acc in acc_to_primary_layer and event_type != "TRANSFER":
            layer_num = acc_to_primary_layer[effective_acc]

        # Data quality flags
        flags: List[str] = []
        if not dt_str:
            flags.append("MISSING_DATETIME")
        if not utr and event_type in {"TRANSFER", "ATM_WITHDRAWAL", "POS_WITHDRAWAL"}:
            flags.append("MISSING_UTR")
        if event_type == "TRANSFER" and not dest_acc:
            flags.append("MISSING_BENEFICIARY")
        if event_type == "ATM_WITHDRAWAL":
            terminal = extract_field(raw, ["ATM ID", "Location", "ATM Location", "Terminal ID", "Place/Location of ATM"])
            if not terminal:
                flags.append("MISSING_ATM_TERMINAL")
        elif event_type == "POS_WITHDRAWAL":
            merchant = extract_field(raw, ["Merchant Name", "MID", "TID", "Merchant"])
            if not merchant:
                flags.append("MISSING_POS_MERCHANT")
        elif event_type == "CHEQUE_WITHDRAWAL":
            cheque_no = extract_field(raw, ["Cheque No", "Cheque Number", "Instrument No"])
            if not cheque_no:
                flags.append("MISSING_CHEQUE_NO")
        elif event_type == "HOLD":
            lien_ref = extract_field(raw, ["Lien Reference", "Hold Reason", "Remarks", "Action Remarks"])
            if not lien_ref:
                flags.append("UNVERIFIED_HOLD_REMARK")
        if bank_name in {"Unknown Bank", ""}:
            flags.append("UNKNOWN_BANK")

        if effective_acc:
            accounts_seen.add(effective_acc)
            acc_layers[effective_acc].add(layer_num)
            acc_banks[effective_acc].add(bank_name)

        if bank_name and bank_name != "Unknown Bank":
            banks_seen.add(bank_name)

        # Duplicate check on non-hold transactions
        tx_fingerprint = (sheet_name or "", primary_acc or "", dest_acc or "", utr or "", amt)
        if tx_fingerprint in seen_tx_fingerprints:
            flags.append("DUPLICATE_TRANSACTION")
        else:
            seen_tx_fingerprints.add(tx_fingerprint)

        event_id = f"evt_{tx_id}_{row_number}"

        evt = {
            "event_id": event_id,
            "db_id": tx_id,
            "source_sheet": sheet_name,
            "source_row": row_number,
            "event_type": event_type,
            "bank": bank_name,
            "dest_bank": dest_bank_name,
            "account_number": primary_acc or dest_acc or "UNSPECIFIED",
            "dest_account": dest_acc,
            "counterparty": dest_acc or extract_field(raw, ["Merchant Name", "Payee Name", "ATM Location", "Place/Location of ATM", "Bank/FIs"]),
            "transaction_datetime": dt_str,
            "transaction_date_clean": pe.get("d_clean"),
            "amount": amt,
            "disputed_amount": disp_amt,
            "utr": utr,
            "layer": layer_num,
            "acknowledgement_no": pe["ack_no"],
            "transaction_description": extract_field(raw, ["Transaction Description", "Remarks", "Action Remarks", "Description"]),
            "data_quality_flags": flags,
            "raw_details": raw,
            "match_status": "UNMATCHED",
            "matched_event_ids": [],
            "verified_hold_amount": 0.0,
        }

        canonical_events.append(evt)

        # Categorize into account-level tracking maps
        if effective_acc:
            if event_type in {"ATM_WITHDRAWAL", "POS_WITHDRAWAL", "CHEQUE_WITHDRAWAL"}:
                acc_withdrawals[effective_acc].append(evt)
            elif event_type == "TRANSFER":
                if primary_acc:
                    acc_outgoing_transfers[primary_acc].append(evt)
                if dest_acc:
                    acc_inflows[dest_acc].append(evt)

    # ------------------------------------------------------------
    # 5. FUND-FLOW LINKING & CONFIDENCE ASSIGNMENT
    # ------------------------------------------------------------
    utr_to_events = defaultdict(list)
    acc_amt_to_events = defaultdict(list)

    for evt in canonical_events:
        if evt["utr"]:
            utr_to_events[evt["utr"]].append(evt)
        if evt["account_number"] and evt["amount"] > 0:
            k = f"{evt['account_number']}@{evt['amount']:.2f}"
            acc_amt_to_events[k].append(evt)

    for evt in canonical_events:
        matched_ids = []
        match_status = "UNMATCHED"

        # Evidence Order 1: Exact UTR match across multiple rows
        if evt["utr"] and len(utr_to_events[evt["utr"]]) > 1:
            for other in utr_to_events[evt["utr"]]:
                if other["event_id"] != evt["event_id"]:
                    matched_ids.append(other["event_id"])
            match_status = "CONFIRMED"

        # Evidence Order 2: Exact destination account and matching amount
        elif evt["dest_account"]:
            k = f"{evt['dest_account']}@{evt['amount']:.2f}"
            cand = [o for o in acc_amt_to_events.get(k, []) if o["event_id"] != evt["event_id"]]
            if cand:
                for c in cand:
                    matched_ids.append(c["event_id"])
                has_date_match = False
                if evt["transaction_datetime"]:
                    for c in cand:
                        if c["transaction_datetime"] and str(c["transaction_datetime"])[:10] == str(evt["transaction_datetime"])[:10]:
                            has_date_match = True
                            break
                match_status = "CONFIRMED" if has_date_match else "PROBABLE"

        # Evidence Order 3: Beneficiary/counterparty relationship
        elif evt["event_type"] == "TRANSFER" and evt["dest_account"]:
            match_status = "PROBABLE"

        # Evidence Order 4: Withdrawals on funded accounts
        elif evt["event_type"] in {"ATM_WITHDRAWAL", "POS_WITHDRAWAL", "CHEQUE_WITHDRAWAL"}:
            acc = evt["account_number"]
            if acc in acc_inflows:
                match_status = "PROBABLE"
                for infl in acc_inflows[acc]:
                    matched_ids.append(infl["event_id"])
            else:
                match_status = "CONFIRMED" if evt["utr"] else "PROBABLE"

        evt["match_status"] = match_status
        evt["matched_event_ids"] = list(set(matched_ids))
        acc = evt["account_number"]
        evt["verified_hold_amount"] = acc_verified_holds.get(acc, 0.0)

    # ------------------------------------------------------------
    # 6. NON-DOUBLE-COUNTING EXPOSURE METRICS (FILE LEVEL)
    # ------------------------------------------------------------
    original_disputed_exposure = layer1_disputed_sum if layer1_disputed_sum > 0 else layer1_inflow_sum
    if original_disputed_exposure == 0.0:
        original_disputed_exposure = sum(e["disputed_amount"] for e in canonical_events if e["layer"] == 1) or sum(e["amount"] for e in canonical_events if e["layer"] == 1)
    if original_disputed_exposure == 0.0:
        original_disputed_exposure = max((e["amount"] for e in canonical_events), default=0.0)

    atm_events = [e for e in canonical_events if e["event_type"] == "ATM_WITHDRAWAL"]
    pos_events = [e for e in canonical_events if e["event_type"] == "POS_WITHDRAWAL"]
    cheque_events = [e for e in canonical_events if e["event_type"] == "CHEQUE_WITHDRAWAL"]
    transfer_events = [e for e in canonical_events if e["event_type"] == "TRANSFER"]
    hold_events = [e for e in canonical_events if e["event_type"] == "HOLD"]

    cash_out_activity = sum(e["amount"] for e in atm_events + pos_events + cheque_events)
    total_verified_hold = sum(acc_verified_holds.values())

    # Unique traced amount: Layer 1 entry inflows to prevent downstream double-counting
    layer1_txs = [e for e in canonical_events if e["layer"] == 1 and e["event_type"] in {"TRANSFER", "OTHER"}]
    unique_traced_amount = sum(e["amount"] for e in layer1_txs) if layer1_txs else (sum(e["amount"] for e in canonical_events if e["event_type"] != "HOLD") or 0.0)

    # Net Unsecured Exposure: Unique funds at risk not cashed out and not secured by bank lien
    unsecured_exposure = max(0.0, unique_traced_amount - total_verified_hold - cash_out_activity)

    confirmed_traced_amount = sum(e["amount"] for e in transfer_events if e["match_status"] == "CONFIRMED")
    probable_traced_amount = sum(e["amount"] for e in transfer_events if e["match_status"] == "PROBABLE")
    uncertain_traced_amount = sum(e["amount"] for e in transfer_events if e["match_status"] == "UNCERTAIN")

    # ------------------------------------------------------------
    # 7. ACTIONABLE ITEM PRIORITY SCORING (0-100 SCALE)
    # ------------------------------------------------------------
    # Eligible scored population: all non-HOLD transactions
    actionable_items: List[Dict[str, Any]] = []

    atm_groups = defaultdict(list)
    for evt in atm_events:
        date_key = str(evt["transaction_datetime"] or "")[:10]
        atm_groups[(evt["account_number"], date_key)].append(evt)

    for evt in canonical_events:
        if evt["event_type"] == "HOLD":
            continue

        acc = evt["account_number"]
        amt = evt["amount"]
        evt_type = evt["event_type"]
        layer = evt["layer"]
        match_status = evt["match_status"]
        flags = evt["data_quality_flags"]

        # --- Factor 1: Immediate Cash-Out / Irreversibility (Weight: 25) ---
        if evt_type == "ATM_WITHDRAWAL":
            f_cashout = 1.0
        elif evt_type in {"POS_WITHDRAWAL", "CHEQUE_WITHDRAWAL"}:
            f_cashout = 0.85
        elif evt_type == "TRANSFER":
            dest = evt["dest_account"]
            if dest and (dest in acc_withdrawals or len(acc_outgoing_transfers.get(dest, [])) > 0):
                f_cashout = 0.6
            elif layer >= 3:
                f_cashout = 0.4
            else:
                f_cashout = 0.2
        else:
            f_cashout = 0.1

        # --- Factor 2: Unsecured Exposure (Weight: 25) ---
        acc_hold = acc_verified_holds.get(acc, 0.0)
        item_unsecured = max(0.0, amt - acc_hold)
        if item_unsecured <= 0.0:
            f_unsecured = 0.0
        else:
            ratio = item_unsecured / (original_disputed_exposure if original_disputed_exposure > 0 else 100000.0)
            if ratio >= 0.5 or item_unsecured >= 1000000.0:
                f_unsecured = 1.0
            elif ratio >= 0.25 or item_unsecured >= 500000.0:
                f_unsecured = 0.8
            elif ratio >= 0.1 or item_unsecured >= 100000.0:
                f_unsecured = 0.6
            elif item_unsecured >= 25000.0:
                f_unsecured = 0.4
            else:
                f_unsecured = 0.2

        # --- Factor 3: Fund-Flow Complexity / Dispersal (Weight: 20) ---
        dest_receivers_count = len(acc_outgoing_transfers.get(evt["dest_account"], [])) if evt["dest_account"] else 0
        if layer >= 4 or dest_receivers_count >= 3:
            f_complexity = 1.0
        elif layer == 3 or dest_receivers_count >= 2:
            f_complexity = 0.75
        elif layer == 2:
            f_complexity = 0.5
        elif dest_receivers_count == 1:
            f_complexity = 0.35
        else:
            f_complexity = 0.2

        # --- Factor 4: Suspicious Pattern Indicators (Weight: 20) ---
        f_pattern = 0.1
        date_key = str(evt["transaction_datetime"] or "")[:10]
        if evt_type == "ATM_WITHDRAWAL" and len(atm_groups.get((acc, date_key), [])) >= 2:
            f_pattern += 0.5
        if amt > 0 and amt % 10000 == 0:
            f_pattern += 0.2
        if evt_type == "TRANSFER" and acc in acc_inflows and len(acc_outgoing_transfers.get(acc, [])) >= 2:
            f_pattern += 0.3
        f_pattern = min(1.0, f_pattern)

        # --- Factor 5: Investigation Urgency (Weight: 10) ---
        if item_unsecured > 0 and evt_type == "TRANSFER" and layer <= 2:
            f_urgency = 0.9
        elif evt_type in {"ATM_WITHDRAWAL", "POS_WITHDRAWAL"}:
            f_urgency = 0.8
        elif item_unsecured > 0:
            f_urgency = 0.6
        else:
            f_urgency = 0.2

        # --- Match Confidence Discount Safeguard ---
        discount = 1.0
        if match_status == "UNCERTAIN":
            discount = 0.6
        elif match_status == "UNMATCHED":
            discount = 0.75

        raw_score = (
            active_weights["immediate_cash_out"] * f_cashout +
            active_weights["unsecured_exposure"] * f_unsecured +
            active_weights["fund_flow_complexity"] * f_complexity +
            active_weights["pattern_indicators"] * f_pattern +
            active_weights["investigation_urgency"] * f_urgency
        ) * discount

        score = round(max(0.0, min(100.0, raw_score)), 1)

        # Priority Band
        if score >= active_thresholds["CRITICAL"]:
            priority = "CRITICAL"
        elif score >= active_thresholds["HIGH"]:
            priority = "HIGH"
        elif score >= active_thresholds["MEDIUM"]:
            priority = "MEDIUM"
        else:
            priority = "LOW"

        # Confidence Level
        if match_status == "CONFIRMED" and len(flags) == 0:
            confidence = "HIGH"
        elif match_status in {"CONFIRMED", "PROBABLE"} and len(flags) <= 1:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        # Natural language risk reason
        reasons: List[str] = []
        if f_cashout >= 0.8:
            reasons.append(f"Irreversible {evt_type.replace('_', ' ').title()} of ₹{amt:,.2f}")
        if f_unsecured >= 0.8:
            reasons.append(f"High unsecured exposure of ₹{item_unsecured:,.2f} at Layer {layer}")
        if f_complexity >= 0.75:
            reasons.append(f"Deep fund layering (Layer {layer}) with multi-hop dispersal")
        if f_pattern >= 0.5:
            reasons.append("Sequential rapid dispersal pattern detected on account")
        if not reasons:
            reasons.append(f"Standard {evt_type.replace('_', ' ').title()} fund movement of ₹{amt:,.2f}")

        risk_reason = "; ".join(reasons)

        # Actionable lead
        if evt_type == "ATM_WITHDRAWAL":
            terminal = extract_field(evt["raw_details"], ["ATM ID", "Location", "ATM Location", "Place/Location of ATM"]) or "designated terminal"
            rec_action = f"Request CCTV footage, terminal journal logs, and dispensation slips from {evt['bank']} for ATM {terminal}."
        elif evt_type == "POS_WITHDRAWAL":
            merchant = extract_field(evt["raw_details"], ["Merchant Name", "MID", "TID"]) or "POS merchant"
            rec_action = f"Issue notice to acquirer {evt['bank']} to obtain KYC, merchant agreements, and settlement account for {merchant}."
        elif evt_type == "CHEQUE_WITHDRAWAL":
            cheque_no = extract_field(evt["raw_details"], ["Cheque No", "Cheque Number", "Instrument No"]) or "issued cheque"
            rec_action = f"Procure copy of Cheque #{cheque_no}, clearing image, and beneficiary branch record from {evt['bank']}."
        elif item_unsecured > 0 and layer <= 2:
            rec_action = f"Issue urgent statutory debit freeze requisition to {evt['bank']} for account {mask_account_number(acc)} (Unsecured: ₹{item_unsecured:,.2f})."
        elif match_status == "PROBABLE":
            rec_action = f"Reconcile UTR {evt['utr'] or 'reference'} with {evt['bank']} to confirm beneficiary account before tracing next hop."
        else:
            rec_action = f"Verify account KYC and transaction trail with {evt['bank']} for Layer {layer} entity."

        item = {
            "id": evt["event_id"],
            "event_type": evt_type,
            "priority": priority,
            "tier": priority,
            "score": score,
            "confidence": confidence,
            "match_status": match_status,
            "layer": f"Layer {layer}",
            "layer_number": layer,
            "bank": evt["bank"],
            "bank_name": evt["bank"],
            "account": acc,
            "account_number": acc,
            "masked_account": mask_account_number(acc),
            "dest_account": evt["dest_account"],
            "dest_bank": evt["dest_bank"],
            "utr": evt["utr"] or "Not Available",
            "transaction_datetime": evt["transaction_datetime"] or "Not Available",
            "amount": amt,
            "linked_disputed_exposure": min(amt, original_disputed_exposure),
            "verified_hold_amount": acc_hold,
            "unsecured_exposure": item_unsecured,
            "risk_reason": risk_reason,
            "primary_reason": risk_reason,
            "reasons": [r.strip() for r in risk_reason.split(";") if r.strip()] if risk_reason else ["Priority investigation lead"],
            "recommended_action": rec_action,
            "source_sheet": evt["source_sheet"],
            "source_row": evt["source_row"],
            "source_evidence": {
                "sheet": evt["source_sheet"],
                "row": evt["source_row"],
                "utr": evt["utr"] or "Not Available",
                "raw_data": evt.get("raw_details"),
            },
            "data_quality_flags": flags,
            "factor_scores": {
                "immediate_cash_out": round(f_cashout, 2),
                "unsecured_exposure": round(f_unsecured, 2),
                "fund_flow_complexity": round(f_complexity, 2),
                "pattern_indicators": round(f_pattern, 2),
                "investigation_urgency": round(f_urgency, 2),
            },
            "factor_breakdown": {
                "cash_out": round(f_cashout * 25, 1),
                "unsecured_exposure": round(f_unsecured * 25, 1),
                "complexity": round(f_complexity * 20, 1),
                "patterns": round(f_pattern * 20, 1),
                "urgency": round(f_urgency * 10, 1),
            },
        }
        actionable_items.append(item)

    actionable_items.sort(key=lambda x: x["score"], reverse=True)

    # ------------------------------------------------------------
    # 8. PRIORITY DISTRIBUTION & CONSISTENCY GUARANTEE
    # ------------------------------------------------------------
    crit_items = [i for i in actionable_items if i["priority"] == "CRITICAL"]
    high_items = [i for i in actionable_items if i["priority"] == "HIGH"]
    med_items = [i for i in actionable_items if i["priority"] == "MEDIUM"]
    low_items = [i for i in actionable_items if i["priority"] == "LOW"]

    total_actionable = len(actionable_items)
    priority_distribution = {
        "total_items": total_actionable,
        "total_count": total_actionable,
        "critical": {
            "count": len(crit_items),
            "percentage": round((len(crit_items) / total_actionable * 100), 1) if total_actionable else 0.0,
            "linked_exposure": sum(i["amount"] for i in crit_items),
            "score_range": "75.0 – 100.0",
        },
        "high": {
            "count": len(high_items),
            "percentage": round((len(high_items) / total_actionable * 100), 1) if total_actionable else 0.0,
            "linked_exposure": sum(i["amount"] for i in high_items),
            "score_range": "50.0 – 74.9",
        },
        "medium": {
            "count": len(med_items),
            "percentage": round((len(med_items) / total_actionable * 100), 1) if total_actionable else 0.0,
            "linked_exposure": sum(i["amount"] for i in med_items),
            "score_range": "25.0 – 49.9",
        },
        "low": {
            "count": len(low_items),
            "percentage": round((len(low_items) / total_actionable * 100), 1) if total_actionable else 0.0,
            "linked_exposure": sum(i["amount"] for i in low_items),
            "score_range": "0.0 – 24.9",
        },
    }

    # ------------------------------------------------------------
    # 9. SECTION C: LAYER-WISE RISK HEATMAP (DYNAMIC & RECONCILED)
    # ------------------------------------------------------------
    all_layers_present = set(layer_verified_holds.keys())
    for item in actionable_items:
        all_layers_present.add(item["layer_number"])
    for pe in parsed_raw_events:
        all_layers_present.add(pe["layer_num"])

    layer_map = defaultdict(lambda: {
        "layer_num": 0,
        "banks": set(),
        "accounts": set(),
        "item_count": 0,
        "unique_traced_amount": 0.0,
        "cash_out_amount": 0.0,
        "verified_held_amount": 0.0,
        "critical_count": 0,
        "high_count": 0,
        "missing_evidence_categories": set(),
    })

    for item in actionable_items:
        l_num = item["layer_number"]
        entry = layer_map[l_num]
        entry["layer_num"] = l_num
        entry["banks"].add(item["bank"])
        entry["accounts"].add(item["account_number"])
        if item.get("dest_account"):
            entry["accounts"].add(item["dest_account"])
        entry["item_count"] += 1
        entry["unique_traced_amount"] += item["amount"]
        if item["event_type"] in {"ATM_WITHDRAWAL", "POS_WITHDRAWAL", "CHEQUE_WITHDRAWAL"}:
            entry["cash_out_amount"] += item["amount"]
        if item["priority"] == "CRITICAL":
            entry["critical_count"] += 1
        elif item["priority"] == "HIGH":
            entry["high_count"] += 1
        for f in item["data_quality_flags"]:
            entry["missing_evidence_categories"].add(f.replace("_", " ").title())

    # Map verified hold records directly to the correct layer (Resolves ₹2 discrepancy)
    for hr in raw_hold_rows:
        h_layer = hr["layer"]
        entry = layer_map[h_layer]
        entry["layer_num"] = h_layer
        entry["accounts"].add(hr["account"])
        if hr["bank"] and hr["bank"] != "Unknown Bank":
            entry["banks"].add(hr["bank"])

    layer_heatmap: List[Dict[str, Any]] = []
    for l_num in sorted(all_layers_present):
        if l_num <= 0:
            continue
        data = layer_map[l_num]
        held_amt = round(layer_verified_holds.get(l_num, 0.0), 2)
        traced_amt = round(data["unique_traced_amount"], 2)
        cash_amt = round(data["cash_out_amount"], 2)

        # Unsecured exposure at layer: traced flow not cashed out and not secured by bank hold
        unsecured_amt = max(0.0, round(traced_amt - cash_amt - held_amt, 2))

        # Hold status determination
        if held_amt == 0.0:
            hold_status = "UNSECURED"
        elif unsecured_amt == 0.0:
            hold_status = "FULLY HELD"
        else:
            hold_status = "PARTIALLY HELD"

        crit_ratio = (data["critical_count"] + data["high_count"]) / max(1, data["item_count"])
        if crit_ratio >= 0.5:
            overall_risk = "CRITICAL"
        elif crit_ratio >= 0.25:
            overall_risk = "HIGH"
        elif crit_ratio > 0:
            overall_risk = "MEDIUM"
        else:
            overall_risk = "LOW"

        layer_heatmap.append({
            "layer": f"Layer {l_num}",
            "layer_number": l_num,
            "layer_name": f"Layer {l_num}",
            "banks": sorted(list(data["banks"])),
            "banks_count": len(data["banks"]),
            "accounts_count": len(data["accounts"]),
            "item_count": data["item_count"],
            "unique_traced_amount": traced_amt,
            "cash_out_amount": cash_amt,
            "verified_hold_amount": held_amt,
            "verified_held_amount": held_amt,
            "unsecured_amount": unsecured_amt,
            "unsecured_exposure": unsecured_amt,
            "hold_status": hold_status,
            "has_verified_hold": held_amt > 0,
            "critical_count": data["critical_count"],
            "high_count": data["high_count"],
            "missing_evidence_categories": sorted(list(data["missing_evidence_categories"])),
            "missing_evidence_summary": ", ".join(sorted(list(data["missing_evidence_categories"]))) if data["missing_evidence_categories"] else "Complete",
            "overall_risk": overall_risk,
        })

    # ------------------------------------------------------------
    # 10. CASH WITHDRAWAL & FUND DISPERSAL ANALYSIS (SECTION E)
    # ------------------------------------------------------------
    atm_analysis = []
    for e in atm_events:
        raw = e["raw_details"]
        _atm_term = extract_field(raw, ["ATM ID", "Location", "ATM Location", "Terminal ID", "Place/Location of ATM"]) or "Not Available"
        atm_analysis.append({
            "id": e["event_id"],
            "amount": e["amount"],
            "account": e["account_number"],
            "masked_account": mask_account_number(e["account_number"]),
            "bank": e["bank"],
            "bank_name": e["bank"],
            "layer": f"Layer {e['layer']}",
            "terminal_location": _atm_term,
            "location": _atm_term,
            "atm_id": extract_field(raw, ["ATM ID", "Terminal ID"]) or _atm_term,
            "datetime": e["transaction_datetime"] or "Not Available",
            "date": str(e["transaction_datetime"] or "")[:10] or "Not Available",
            "sequential_group": "Group A" if len(atm_groups.get((e["account_number"], str(e["transaction_datetime"] or "")[:10]), [])) > 1 else "Single Withdrawal",
            "linked_exposure": e["disputed_amount"] or e["amount"],
            "evidence_confidence": "HIGH" if "MISSING_ATM_TERMINAL" not in e["data_quality_flags"] else "MEDIUM",
            "source_reference": f"Sheet: {e['source_sheet']}, Row: {e['source_row']}",
            "recommended_lead": f"Subpoena CCTV / Terminal Logs for {e['bank']}",
        })

    pos_analysis = []
    for e in pos_events:
        raw = e["raw_details"]
        _pos_merch = extract_field(raw, ["Merchant Name", "MID", "Merchant", "Merchant ID"]) or "Not Available"
        pos_analysis.append({
            "id": e["event_id"],
            "amount": e["amount"],
            "account": e["account_number"],
            "masked_account": mask_account_number(e["account_number"]),
            "bank": e["bank"],
            "bank_name": e["bank"],
            "layer": f"Layer {e['layer']}",
            "merchant_mid": _pos_merch,
            "merchant": _pos_merch,
            "terminal_id": extract_field(raw, ["MID", "Terminal ID", "Merchant ID"]) or _pos_merch,
            "acquirer_settlement": extract_field(raw, ["Settlement Bank", "Acquirer", "Acquiring Bank"]) or e["bank"],
            "settlement_account": extract_field(raw, ["Settlement Account", "Settlement A/C No"]) or "Not Available",
            "datetime": e["transaction_datetime"] or "Not Available",
            "date": str(e["transaction_datetime"] or "")[:10] or "Not Available",
            "linked_exposure": e["disputed_amount"] or e["amount"],
            "evidence_confidence": "HIGH" if "MISSING_POS_MERCHANT" not in e["data_quality_flags"] else "MEDIUM",
            "source_reference": f"Sheet: {e['source_sheet']}, Row: {e['source_row']}",
            "recommended_lead": f"Notice to acquirer {e['bank']} for KYC / settlement account",
        })

    cheque_analysis = []
    for e in cheque_events:
        raw = e["raw_details"]
        _chq_num = extract_field(raw, ["Cheque No", "Cheque Number", "Instrument No"]) or "Not Available"
        cheque_analysis.append({
            "id": e["event_id"],
            "amount": e["amount"],
            "account": e["account_number"],
            "masked_account": mask_account_number(e["account_number"]),
            "bank": e["bank"],
            "bank_name": e["bank"],
            "layer": f"Layer {e['layer']}",
            "cheque_number": _chq_num,
            "cheque_no": _chq_num,
            "payee": extract_field(raw, ["Payee Name", "Beneficiary Name", "Favoring"]) or "Not Available",
            "branch": extract_field(raw, ["Branch", "Branch Name", "Clearing Branch", "Branch Location"]) or "Not Available",
            "datetime": e["transaction_datetime"] or "Not Available",
            "date": str(e["transaction_datetime"] or "")[:10] or "Not Available",
            "linked_exposure": e["disputed_amount"] or e["amount"],
            "evidence_confidence": "HIGH" if "MISSING_CHEQUE_NO" not in e["data_quality_flags"] else "MEDIUM",
            "source_reference": f"Sheet: {e['source_sheet']}, Row: {e['source_row']}",
            "recommended_lead": f"Summon physical instrument and clearing voucher from {e['bank']}",
        })

    downstream_transfers = []
    seen_transfer_fingerprints = set()
    for e in transfer_events:
        # Deduplication check
        utr_val = (e.get("utr") or "").strip()
        amt_val = round(float(e.get("amount") or 0.0), 2)
        s_acc = e.get("account_number") or ""
        d_acc = e.get("dest_account") or ""
        dt_val = str(e.get("transaction_date_clean") or e.get("transaction_datetime") or "")[:10]

        if utr_val and utr_val.lower() not in {"not available", "na", "n/a", "none", "-", "null"}:
            fp = ("UTR", utr_val, amt_val, s_acc, d_acc)
        else:
            fp = ("ACC_AMT_DT", s_acc, d_acc, amt_val, dt_val)

        if fp in seen_transfer_fingerprints:
            continue
        seen_transfer_fingerprints.add(fp)

        raw = e.get("raw_details") or {}
        acc_hold = acc_verified_holds.get(s_acc, 0.0)
        unsecured = max(0.0, e["amount"] - acc_hold)

        # Source and destination details
        s_bank = e.get("bank") or "Unknown Bank"
        d_bank = e.get("dest_bank") or e.get("bank") or "Unknown Bank"

        # Date & Datetime handling
        d_clean = e.get("transaction_date_clean")
        dt_full = e.get("transaction_datetime")
        display_date = d_clean or (str(dt_full)[:10] if dt_full else None)

        # Target / beneficiary account display
        target_acc = d_acc or s_acc or "Not Available"
        target_masked = mask_account_number(target_acc) if target_acc != "Not Available" else "Not Available"

        # Remarks extraction from raw worksheet
        remarks = (
            extract_field(raw, [
                "Remarks", "Action Remarks", "Transaction Description", "Description",
                "Narration", "Remarks / Description", "Transfer Remarks"
            ])
            or e.get("transaction_description")
        )
        if not remarks:
            if utr_val and utr_val.lower() not in {"not available", "na", "n/a", "none", "-", "null"}:
                remarks = f"Inter-bank transfer via UTR {utr_val}"
            else:
                remarks = "Direct downstream transfer"

        # Recommended investigation lead
        if unsecured > 0 and e["layer"] <= 2:
            lead = f"Issue urgent Section 91 CrPC freeze requisition to {d_bank} for account {target_masked} (Unsecured: ₹{unsecured:,.2f})"
        elif utr_val and utr_val.lower() not in {"not available", "na", "n/a", "none", "-", "null"}:
            lead = f"Reconcile UTR {utr_val} with {d_bank} to verify beneficiary KYC and trace onwards"
        elif d_bank and d_bank != "Unknown Bank":
            lead = f"Requisition beneficiary KYC, mandate, and account statement from {d_bank} for Layer {e['layer']} entity"
        else:
            lead = f"Requisition beneficiary KYC and statement to trace Layer {e['layer']} flow"

        downstream_transfers.append({
            "id": e["event_id"],
            "date": display_date,
            "datetime": dt_full or display_date,
            "account": target_acc,
            "masked_account": target_masked,
            "bank": d_bank,
            "source_account": s_acc,
            "source_masked": mask_account_number(s_acc) if s_acc else "Not Available",
            "source_bank": s_bank,
            "dest_account": d_acc or "Not Available",
            "dest_masked": mask_account_number(d_acc) if d_acc else "Not Available",
            "beneficiary_account": d_acc or "Not Available",
            "beneficiary_masked": mask_account_number(d_acc) if d_acc else "Not Available",
            "dest_bank": d_bank,
            "beneficiary_bank": d_bank,
            "transfer_flow": f"From: {mask_account_number(s_acc)} ({s_bank}) → To: {mask_account_number(d_acc)} ({d_bank})",
            "amount": e["amount"],
            "utr": e["utr"] or "Not Available",
            "layer": f"Layer {e['layer']}",
            "layer_num": e["layer"],
            "beneficiary_count": len(acc_outgoing_transfers.get(d_acc, [])) if d_acc else 0,
            "unsecured_exposure": unsecured,
            "remarks": remarks,
            "recommended_lead": lead,
            "match_confidence": e["match_status"],
            "source_reference": f"Sheet: {e['source_sheet']}, Row: {e['source_row']}",
        })

    cash_out_analysis = {
        "atm_withdrawals": atm_analysis,
        "pos_withdrawals": pos_analysis,
        "pos_transactions": pos_analysis,
        "cheque_withdrawals": cheque_analysis,
        "downstream_transfers": downstream_transfers,
        "other_dispersals": downstream_transfers,
        "summary": {
            "total_atm_amount": sum(e["amount"] for e in atm_events),
            "total_atm_count": len(atm_events),
            "total_pos_amount": sum(e["amount"] for e in pos_events),
            "total_pos_count": len(pos_events),
            "total_cheque_amount": sum(e["amount"] for e in cheque_events),
            "total_cheque_count": len(cheque_events),
            "total_cash_out": cash_out_activity,
        },
    }

    # ------------------------------------------------------------
    # 11. BANK-WISE INVESTIGATION GAPS (SECTION F)
    # ------------------------------------------------------------
    investigation_gaps: List[Dict[str, Any]] = []
    gap_set = set()

    for evt in canonical_events:
        acc = evt["account_number"]
        bank = evt["bank"]
        layer = evt["layer"]
        src_ref = f"{evt['source_sheet']} (Row {evt['source_row']})"

        for flag in evt["data_quality_flags"]:
            gap_key = f"{bank}@{acc}@{flag}"
            if gap_key in gap_set:
                continue
            gap_set.add(gap_key)

            if flag == "MISSING_DATETIME":
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": "Transaction Timestamp / Date Missing",
                    "why_it_matters": "Prevents precise chronological sequence reconstruction and fund velocity audit.",
                    "recommended_action": f"Request official core banking statement with exact timestamp from {bank}.",
                    "priority": "HIGH" if layer <= 2 else "MEDIUM",
                    "source_reference": src_ref,
                }
            elif flag == "MISSING_UTR":
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": "UTR / Clearing Reference Number Absent",
                    "why_it_matters": "Impairs definitive inter-bank settlement linking between source and destination accounts.",
                    "recommended_action": f"Issue requisition to {bank} to supply NEFT/RTGS/IMPS clearing UTR.",
                    "priority": "HIGH",
                    "source_reference": src_ref,
                }
            elif flag == "MISSING_BENEFICIARY":
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": "Destination Beneficiary Account Number Missing",
                    "why_it_matters": "Leaves money transfer chain incomplete; cannot trace subsequent downstream layers.",
                    "recommended_action": f"Summon destination mandate and beneficiary schedule from {bank}.",
                    "priority": "HIGH",
                    "source_reference": src_ref,
                }
            elif flag == "MISSING_ATM_TERMINAL":
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": "ATM Terminal ID / Location Identifier Missing",
                    "why_it_matters": "Cannot dispatch CCTV footage preservation notices without physical ATM location.",
                    "recommended_action": f"Obtain ATM switch log and physical kiosk address from {bank}.",
                    "priority": "HIGH",
                    "source_reference": src_ref,
                }
            elif flag == "MISSING_POS_MERCHANT":
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": "Merchant Identity / MID / TID Not Recorded",
                    "why_it_matters": "Prevents identifying physical point-of-sale outlet or merchant payment gateway.",
                    "recommended_action": f"Direct POS acquirer bank to produce Merchant Onboarding KYC and settlement records.",
                    "priority": "MEDIUM",
                    "source_reference": src_ref,
                }
            elif flag == "MISSING_CHEQUE_NO":
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": "Cheque Leaf Number / Instrument Details Absent",
                    "why_it_matters": "Cannot verify drawer signature, bearer identity, or counter-clearing branch.",
                    "recommended_action": f"Requisition CTS clearing image of cheque leaf from {bank}.",
                    "priority": "MEDIUM",
                    "source_reference": src_ref,
                }
            elif flag == "UNVERIFIED_HOLD_REMARK":
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": "Hold / Lien Reference Number Unverified",
                    "why_it_matters": "Risk that funds have not been legally frozen or may be unblocked without court order.",
                    "recommended_action": f"Request written lien acknowledgment certificate and current freeze balance from {bank}.",
                    "priority": "HIGH",
                    "source_reference": src_ref,
                }
            elif flag == "DUPLICATE_TRANSACTION":
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": "Duplicate Transaction Row Detected in Workbook",
                    "why_it_matters": "Potential risk of inflated exposure volume due to repeated identical records.",
                    "recommended_action": f"Cross-verify transaction reference {evt['utr']} against core bank ledger to confirm if single or repeated debit.",
                    "priority": "MEDIUM",
                    "source_reference": src_ref,
                }
            else:
                gap_item = {
                    "bank": bank,
                    "bank_name": bank,
                    "account": acc,
                    "masked_account": mask_account_number(acc),
                    "affected_layer": f"Layer {layer}",
                    "layer": f"Layer {layer}",
                    "missing_evidence": flag.replace("_", " ").title(),
                    "why_it_matters": "Incomplete source entry creates investigative ambiguity.",
                    "recommended_action": f"Verify supporting source documentation from {bank}.",
                    "priority": "LOW",
                    "source_reference": src_ref,
                }
            investigation_gaps.append(gap_item)

    # ------------------------------------------------------------
    # 12. RECOMMENDED INVESTIGATION ACTIONS (SECTION G)
    # ------------------------------------------------------------
    recommended_actions: List[Dict[str, Any]] = []
    seen_action_keys = set()

    for item in actionable_items[:40]:
        action_key = f"{item['bank']}@{item['account_number']}@{item['recommended_action']}"
        if action_key in seen_action_keys:
            continue
        seen_action_keys.add(action_key)

        recommended_actions.append({
            "action_priority": item["priority"],
            "urgency": item["priority"],
            "action_description": item["recommended_action"],
            "action": item["recommended_action"],
            "reason": item["risk_reason"],
            "supporting_account": item["account_number"],
            "account": item["account_number"],
            "supporting_masked": item["masked_account"],
            "bank": item["bank"],
            "bank_name": item["bank"],
            "target_entity": item["bank"],
            "utr": item["utr"],
            "source_reference": f"Sheet: {item['source_sheet']}, Row: {item['source_row']}",
            "evidence_confidence": item["confidence"],
            "evidence_basis": f"{item['risk_reason']} (Sheet: {item['source_sheet']}, Row: {item['source_row']})",
            "related_gap": item["data_quality_flags"][0].replace("_", " ").title() if item["data_quality_flags"] else None,
        })

    # ------------------------------------------------------------
    # 13. BANK EXPOSURE CONCENTRATION MATRIX (SECTION H)
    # ------------------------------------------------------------
    bank_risk_summary = defaultdict(lambda: {
        "bank": "",
        "accounts": set(),
        "total_amount": 0.0,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "cash_out_amount": 0.0,
        "verified_hold_amount": 0.0,
        "gap_count": 0,
    })

    for item in actionable_items:
        b = item["bank"]
        if not b or b == "Unknown Bank":
            continue
        entry = bank_risk_summary[b]
        entry["bank"] = b
        entry["accounts"].add(item["account_number"])
        entry["total_amount"] += item["amount"]
        if item["priority"] == "CRITICAL":
            entry["critical_count"] += 1
        elif item["priority"] == "HIGH":
            entry["high_count"] += 1
        elif item["priority"] == "MEDIUM":
            entry["medium_count"] += 1
        else:
            entry["low_count"] += 1
        if item["event_type"] in {"ATM_WITHDRAWAL", "POS_WITHDRAWAL", "CHEQUE_WITHDRAWAL"}:
            entry["cash_out_amount"] += item["amount"]

    for hr in raw_hold_rows:
        b = hr["bank"]
        if b and b != "Unknown Bank":
            entry = bank_risk_summary[b]
            entry["bank"] = b
            entry["accounts"].add(hr["account"])
            entry["verified_hold_amount"] += hr["amount"]

    for gap in investigation_gaps:
        b = gap["bank"]
        if b in bank_risk_summary:
            bank_risk_summary[b]["gap_count"] += 1

    bank_risk_matrix = []
    for b_name in sorted(bank_risk_summary.keys()):
        data = bank_risk_summary[b_name]
        tot_amt = round(data["total_amount"], 2)
        cash_amt = round(data["cash_out_amount"], 2)
        hold_amt = round(data["verified_hold_amount"], 2)
        unsecured = max(0.0, round(tot_amt - cash_amt - hold_amt, 2))

        if tot_amt == 0.0 and hold_amt == 0.0:
            status_text = "NO EXPOSURE"
        elif hold_amt > 0.0 and unsecured == 0.0:
            status_text = "FULLY HELD"
        elif hold_amt > 0.0:
            status_text = "PARTIALLY HELD"
        else:
            status_text = "UNSECURED"

        bank_risk_matrix.append({
            "bank": b_name,
            "bank_name": b_name,
            "accounts_count": len(data["accounts"]),
            "total_amount": tot_amt,
            "total_traced_amount": tot_amt,
            "cash_out_amount": cash_amt,
            "verified_hold_amount": hold_amt,
            "verified_held_amount": hold_amt,
            "unsecured_amount": unsecured,
            "unsecured_exposure": unsecured,
            "triage_status": status_text,
            "critical_count": data["critical_count"],
            "high_count": data["high_count"],
            "medium_count": data["medium_count"],
            "low_count": data["low_count"],
            "gap_count": data["gap_count"],
        })

    tx_type_summary = defaultdict(lambda: {"count": 0, "amount": 0.0, "critical_count": 0})
    for item in actionable_items:
        t = item["event_type"]
        tx_type_summary[t]["count"] += 1
        tx_type_summary[t]["amount"] += item["amount"]
        if item["priority"] == "CRITICAL":
            tx_type_summary[t]["critical_count"] += 1

    tx_type_matrix = [
        {
            "event_type": t_name,
            "label": t_name.replace("_", " ").title(),
            "count": data["count"],
            "amount": round(data["amount"], 2),
            "critical_count": data["critical_count"],
        }
        for t_name, data in tx_type_summary.items()
    ]

    investigation_risk_heatmap = {
        "bank_concentration": bank_risk_matrix,
        "bank_matrix": bank_risk_matrix,
        "transaction_type_concentration": tx_type_matrix,
    }

    # ------------------------------------------------------------
    # 14. SECTION J: HIERARCHICAL MONEY FLOW DAG (ACC & TERMINAL)
    # ------------------------------------------------------------
    graph_nodes = []
    graph_edges = []
    graph_node_accounts = set()

    max_layer = max(all_layers_present, default=1)

    # 14a. Build Account Nodes
    for acc in sorted(accounts_seen):
        if not acc:
            continue
        graph_node_accounts.add(acc)
        acc_items = [i for i in actionable_items if i["account_number"] == acc or i.get("dest_account") == acc]
        top_item = acc_items[0] if acc_items else None

        p_layer = acc_to_primary_layer.get(acc, min(acc_layers.get(acc, {1})))
        hold_amt = acc_verified_holds.get(acc, 0.0)
        has_hold = hold_amt > 0
        total_tx_out = len(acc_outgoing_transfers.get(acc, []))
        total_wdr = len(acc_withdrawals.get(acc, []))

        # Node role and category
        if p_layer == 1:
            category = "SOURCE"
            role = "START"
        elif has_hold:
            category = "HELD"
            role = "TERMINAL_HELD" if total_tx_out == 0 else "INTERMEDIARY"
        elif total_wdr > 0 and total_tx_out == 0:
            category = "CASH_OUT"
            role = "TERMINAL_CASHOUT"
        elif total_tx_out > 0:
            category = "ACCOUNT"
            role = "INTERMEDIARY"
        else:
            category = "ACCOUNT"
            role = "TERMINAL_UNSECURED"

        graph_nodes.append({
            "id": acc,
            "name": mask_account_number(acc),
            "account": acc,
            "masked_account": mask_account_number(acc),
            "bank": list(acc_banks.get(acc, {"Unknown Bank"}))[0],
            "layer": f"Layer {p_layer}",
            "layer_number": p_layer,
            "priority": top_item["priority"] if top_item else "LOW",
            "priority_tier": top_item["priority"] if top_item else "LOW",
            "priority_score": top_item["score"] if top_item else 10.0,
            "score": top_item["score"] if top_item else 10.0,
            "confidence": top_item["confidence"] if top_item else "MEDIUM",
            "hold_amount": hold_amt,
            "has_hold": has_hold,
            "category": category,
            "role": role,
            "amount": sum(i["amount"] for i in acc_items) if acc_items else 0.0,
            "total_transfers": total_tx_out,
            "total_withdrawals": total_wdr,
        })

    # 14b. Directed Transfer Edges
    seen_edge_keys = set()
    for e in transfer_events:
        src = e["account_number"]
        dest = e["dest_account"]
        if src and dest:
            edge_key = (src, dest, e["utr"] or "", e["amount"], e["layer"])
            if edge_key in seen_edge_keys:
                continue
            seen_edge_keys.add(edge_key)

            graph_edges.append({
                "id": f"edge_{src}->{dest}_{e['event_id']}",
                "source": src,
                "target": dest,
                "amount": e["amount"],
                "utr": e["utr"] or "Not Available",
                "layer": e["layer"],
                "match_status": e["match_status"],
                "source_sheet": e["source_sheet"],
                "source_row": e["source_row"],
            })

    # 14c. Terminal Cash-Out Nodes & Edges (explicit terminal points)
    for e in atm_events + pos_events + cheque_events:
        t_id = f"term_{e['event_id']}"
        term_label = e["event_type"].replace("_WITHDRAWAL", "").replace("_", " ").title()
        if e["event_type"] == "ATM_WITHDRAWAL":
            term_detail = extract_field(e["raw_details"], ["ATM ID", "Place/Location of ATM", "Location"]) or "ATM Dispenser"
        elif e["event_type"] == "POS_WITHDRAWAL":
            term_detail = extract_field(e["raw_details"], ["Merchant Name", "MID"]) or "POS Merchant"
        else:
            term_detail = f"Cheque #{extract_field(e['raw_details'], ['Cheque No']) or 'Counter'}"

        graph_nodes.append({
            "id": t_id,
            "name": f"{term_label}: {term_detail[:18]}",
            "account": t_id,
            "masked_account": term_label,
            "bank": e["bank"],
            "layer": f"Layer {e['layer']}",
            "layer_number": e["layer"],
            "priority": "HIGH",
            "priority_tier": "HIGH",
            "priority_score": 70.0,
            "confidence": "HIGH",
            "hold_amount": 0.0,
            "has_hold": False,
            "category": "CASH_OUT",
            "role": "TERMINAL_CASHOUT",
            "amount": e["amount"],
            "total_transfers": 0,
            "total_withdrawals": 1,
        })

        graph_edges.append({
            "id": f"edge_cashout_{e['account_number']}->{t_id}",
            "source": e["account_number"],
            "target": t_id,
            "amount": e["amount"],
            "utr": e["utr"] or "Cash-Out",
            "layer": e["layer"],
            "match_status": "CONFIRMED",
            "source_sheet": e["source_sheet"],
            "source_row": e["source_row"],
        })

    graph_data = {
        "nodes": graph_nodes,
        "edges": graph_edges,
        "links": graph_edges,
        "max_layer": max_layer,
    }

    # ------------------------------------------------------------
    # 15. EVIDENCE-GROUNDED INVESTIGATION SUMMARY (SECTION I)
    # ------------------------------------------------------------
    highest_prio_item = actionable_items[0] if actionable_items else None
    top_banks = sorted(banks_seen)[:4]

    narrative_findings: List[str] = []
    if highest_prio_item:
        narrative_findings.append(
            f"Highest-priority target is {highest_prio_item['event_type'].replace('_', ' ').title()} "
            f"of ₹{highest_prio_item['amount']:,.2f} on {highest_prio_item['bank']} (Account {highest_prio_item['masked_account']}) "
            f"with Priority Score {highest_prio_item['score']} ({highest_prio_item['priority']}), justified by {highest_prio_item['risk_reason']}."
        )

    if cash_out_activity > 0:
        narrative_findings.append(
            f"Identified irreversible cash-out dispersal totaling ₹{cash_out_activity:,.2f} across "
            f"{len(atm_events)} ATM withdrawals, {len(pos_events)} POS transactions, and {len(cheque_events)} cheque withdrawals."
        )

    if total_verified_hold > 0:
        narrative_findings.append(
            f"Verified bank holds safeguard ₹{total_verified_hold:,.2f} across identified accounts, leaving an estimated "
            f"unsecured exposure of ₹{unsecured_exposure:,.2f} requiring urgent legal lien confirmation."
        )
    else:
        narrative_findings.append(
            f"No verified bank holds are currently confirmed in source data; entire unique traced flow of "
            f"₹{unique_traced_amount:,.2f} remains at unsecured risk."
        )

    if investigation_gaps:
        high_gaps = [g for g in investigation_gaps if g["priority"] == "HIGH"]
        narrative_findings.append(
            f"Identified {len(investigation_gaps)} evidentiary gaps ({len(high_gaps)} high-priority) "
            f"including missing UTRs, unverified hold confirmations, and absent ATM/POS terminal parameters."
        )

    investigation_summary = {
        "headline": f"NCRP Priority Audit: {len(crit_items)} Critical & {len(high_items)} High Priority Investigation Targets Identified",
        "key_findings": narrative_findings,
        "disputed_corpus": f"₹{original_disputed_exposure:,.2f}",
        "unique_traced": f"₹{unique_traced_amount:,.2f}",
        "cash_out_total": f"₹{cash_out_activity:,.2f}",
        "verified_held": f"₹{total_verified_hold:,.2f}",
        "unsecured_exposure": f"₹{unsecured_exposure:,.2f}",
        "max_layer_depth": max_layer,
        "primary_banks": top_banks,
        "immediate_action_count": len(crit_items) + len(high_items),
        "uncertain_links_disclaimer": (
            "Calculations strictly distinguish confirmed, probable, and uncertain transfer hops. "
            "Uncertain links are discounted by 40% and excluded from final fraud determinations. "
            "All priorities represent decision-support urgency rather than definitive adjudication."
        ),
    }

    # ------------------------------------------------------------
    # 16. METHODOLOGY & CALCULATION BASIS DEFINITIONS
    # ------------------------------------------------------------
    methodology = {
        "version": SCORING_POLICY_VERSION,
        "weights": active_weights,
        "thresholds": active_thresholds,
        "factors": {
            "immediate_cash_out": "Scores irreversible movement (ATM=1.0, POS/Cheque=0.85, rapid downstream transfer=0.6).",
            "unsecured_exposure": "Scales at-risk amount relative to exposure. Accounts with 100% verified holds receive 0.",
            "fund_flow_complexity": "Evaluates depth (Layer 3+ = 1.0) and multi-beneficiary dispersal.",
            "pattern_indicators": "Rewards evidence of sequential withdrawals, round amounts, and split transfers.",
            "investigation_urgency": "Prioritizes actionable unheld funds sitting at immediate risk of further withdrawal.",
        },
        "match_confidence_definitions": {
            "CONFIRMED": "Exact UTR match or exact account + amount match with compatible date.",
            "PROBABLE": "Source/destination relationship or withdrawal on recently funded account.",
            "UNCERTAIN": "Incomplete identifiers or amount similarity only; discounted by 40% in scoring.",
            "UNMATCHED": "Isolated record with no defensible connection found.",
        },
        "deduplication_rules": (
            "Deduplication ensures that funds moving across consecutive layers are not summed "
            "as additive fraud loss. Original disputed exposure represents Layer 1 corpus. Unique traced amount "
            "tracks primary flows without double-counting intermediate hops. Hold records are mapped to accounts "
            "and layer without multiplying across outbound transfers."
        ),
    }

    # ------------------------------------------------------------
    # 17. COMPREHENSIVE OVERVIEW DASHBOARD
    # ------------------------------------------------------------
    overview = {
        "disputed_exposure": round(original_disputed_exposure, 2),
        "source_transaction_count": len(all_txs),
        "actionable_item_count": total_actionable,
        "distinct_accounts_count": len(accounts_seen),
        "distinct_banks_count": len(banks_seen),
        "critical_count": len(crit_items),
        "high_count": len(high_items),
        "medium_count": len(med_items),
        "low_count": len(low_items),
        "cash_out_amount": round(cash_out_activity, 2),
        "cash_out_count": len(atm_events) + len(pos_events) + len(cheque_events),
        "verified_held_amount": round(total_verified_hold, 2),
        "held_accounts_count": len([k for k, v in acc_verified_holds.items() if v > 0]),
        "unsecured_exposure": round(unsecured_exposure, 2),
        "unique_traced_amount": round(unique_traced_amount, 2),
        "confirmed_traced_amount": round(confirmed_traced_amount, 2),
        "probable_traced_amount": round(probable_traced_amount, 2),
        "uncertain_traced_amount": round(uncertain_traced_amount, 2),
        "investigation_gaps_count": len(investigation_gaps),
        "recommended_actions_count": len(recommended_actions),
        "calculation_basis": {
            "disputed_exposure": "Derived from verified Layer 1 complaint exposure.",
            "unique_traced_amount": "Total distinct funds traced through DAG without intermediate hop double-counting.",
            "unsecured_exposure": "Unique traced minus verified holds and cash-outs (funds remaining at risk).",
            "cash_out_activity": "Sum of ATM, POS, and Cheque withdrawal records.",
            "verified_held_amount": "Sum of liens and holds recorded by participating banks.",
        },
        "disputed_amount": round(original_disputed_exposure, 2),
        "coverage_pct": round((unique_traced_amount / original_disputed_exposure * 100), 1) if original_disputed_exposure > 0 else 100.0,
        "identified_gaps_count": len(investigation_gaps),
        "high_priority_actions_count": len(recommended_actions),
    }

    return {
        "file_id": file_id,
        "case_id": case_id or (file_obj.case_id if file_obj else 0),
        "filename": filename,
        "acknowledgement_no": workbook_ack_no or "N/A",
        "generated_at": now_iso,
        "report_title": "NCRP Investigation Priority Report",
        "overview": overview,
        "priority_distribution": priority_distribution,
        "layer_heatmap": layer_heatmap,
        "layer_risk_heatmap": layer_heatmap,
        "high_priority_items": actionable_items,
        "cash_out_analysis": cash_out_analysis,
        "cash_withdrawals": cash_out_analysis,
        "investigation_gaps": investigation_gaps,
        "recommended_actions": recommended_actions,
        "investigation_risk_heatmap": investigation_risk_heatmap,
        "risk_heatmap": investigation_risk_heatmap,
        "investigation_summary": investigation_summary,
        "graph_data": graph_data,
        "flow_graph": graph_data,
        "methodology": methodology,
    }


def _build_empty_priority_report(
    file_id: int,
    case_id: int,
    filename: str,
    now_iso: str,
    weights: Dict[str, float],
    thresholds: Dict[str, float],
) -> Dict[str, Any]:
    _empty_cash = {
        "atm_withdrawals": [],
        "pos_withdrawals": [],
        "pos_transactions": [],
        "cheque_withdrawals": [],
        "downstream_transfers": [],
        "other_dispersals": [],
        "summary": {
            "total_atm_amount": 0.0,
            "total_atm_count": 0,
            "total_pos_amount": 0.0,
            "total_pos_count": 0,
            "total_cheque_amount": 0.0,
            "total_cheque_count": 0,
            "total_cash_out": 0.0,
        },
    }
    _empty_risk = {
        "bank_concentration": [],
        "bank_matrix": [],
        "transaction_type_concentration": [],
    }
    _empty_graph = {
        "nodes": [],
        "edges": [],
        "links": [],
        "max_layer": 0,
    }
    _empty_prio = {
        "total_items": 0,
        "total_count": 0,
        "critical": {"count": 0, "percentage": 0.0, "linked_exposure": 0.0, "score_range": "75.0 – 100.0"},
        "high": {"count": 0, "percentage": 0.0, "linked_exposure": 0.0, "score_range": "50.0 – 74.9"},
        "medium": {"count": 0, "percentage": 0.0, "linked_exposure": 0.0, "score_range": "25.0 – 49.9"},
        "low": {"count": 0, "percentage": 0.0, "linked_exposure": 0.0, "score_range": "0.0 – 24.9"},
    }
    return {
        "file_id": file_id,
        "case_id": case_id,
        "filename": filename,
        "acknowledgement_no": "N/A",
        "generated_at": now_iso,
        "report_title": "NCRP Investigation Priority Report",
        "overview": {
            "disputed_exposure": 0.0,
            "disputed_amount": 0.0,
            "source_transaction_count": 0,
            "actionable_item_count": 0,
            "distinct_accounts_count": 0,
            "distinct_banks_count": 0,
            "critical_count": 0,
            "high_count": 0,
            "medium_count": 0,
            "low_count": 0,
            "cash_out_amount": 0.0,
            "cash_out_count": 0,
            "verified_held_amount": 0.0,
            "held_accounts_count": 0,
            "unsecured_exposure": 0.0,
            "unique_traced_amount": 0.0,
            "confirmed_traced_amount": 0.0,
            "probable_traced_amount": 0.0,
            "uncertain_traced_amount": 0.0,
            "investigation_gaps_count": 0,
            "recommended_actions_count": 0,
            "coverage_pct": 0.0,
            "identified_gaps_count": 0,
            "high_priority_actions_count": 0,
        },
        "priority_distribution": _empty_prio,
        "layer_heatmap": [],
        "layer_risk_heatmap": [],
        "high_priority_items": [],
        "cash_out_analysis": _empty_cash,
        "cash_withdrawals": _empty_cash,
        "investigation_gaps": [],
        "recommended_actions": [],
        "investigation_risk_heatmap": _empty_risk,
        "risk_heatmap": _empty_risk,
        "investigation_summary": {
            "headline": "No Investigation Transactions Recorded",
            "key_findings": ["No transaction records were found for the selected NCRP file."],
            "disputed_corpus": "₹0.00",
            "unique_traced": "₹0.00",
            "cash_out_total": "₹0.00",
            "verified_held": "₹0.00",
            "unsecured_exposure": "₹0.00",
            "max_layer_depth": 0,
            "primary_banks": [],
            "immediate_action_count": 0,
            "uncertain_links_disclaimer": "",
        },
        "graph_data": _empty_graph,
        "flow_graph": _empty_graph,
        "methodology": {
            "version": SCORING_POLICY_VERSION,
            "weights": weights,
            "thresholds": thresholds,
        },
    }

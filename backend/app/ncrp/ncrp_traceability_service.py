"""
NCRP Fund Flow Traceability Service (Report 06).
Forensic multi-layer fund-flow tracking, account hierarchy traversal,
terminal account identification, broken link detection, and evidence-based investigative actions.
"""

from collections import defaultdict, deque
import datetime
from decimal import Decimal
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.ncrp.ncrp_priority_service import (
    extract_field,
    parse_clean_amount,
    parse_ncrp_datetime_string,
)
from app.ncrp.ncrp_repository import mask_account_number, normalize_account_identifier


def _is_valid_utr(utr: Optional[str]) -> bool:
    """Check if UTR is a real reference number rather than a placeholder or empty."""
    if not utr:
        return False
    s = str(utr).strip()
    if len(s) < 4:
        return False
    if s.lower() in {
        "na", "n/a", "none", "null", "-", "not available", "nil", "0",
        "pending", "failed", "unspecified", "unknown", "nan"
    }:
        return False
    return True


def get_ncrp_fund_flow_traceability_report_data(
    db: Session,
    file_id: int,
    case_id: Optional[int] = None,
    starting_account: Optional[str] = None,
    max_depth: int = 15,
) -> Dict[str, Any]:
    """
    Generate comprehensive data for Report 06: NCRP Fund Flow Traceability Report.
    Traces fund movement across accounts, identifies intermediary and terminal endpoints,
    audits investigation gaps, and generates evidence-grounded next actions.
    """
    file_obj = db.query(NcrpFile).filter(NcrpFile.id == file_id).first()
    filename = file_obj.original_filename if file_obj else f"File #{file_id}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    if not all_txs:
        return {
            "file_id": file_id,
            "case_id": case_id or 0,
            "filename": filename,
            "generated_at": now_iso,
            "report_title": "NCRP Fund Flow Traceability Report",
            "starting_accounts": [],
            "selected_starting_account": starting_account or "ALL",
            "summary_kpis": {
                "total_ncrp_transactions": 0,
                "total_recorded_inflow": 0.0,
                "total_recorded_outflow": 0.0,
                "distinct_accounts_count": 0,
                "confirmed_links_count": 0,
                "possible_links_count": 0,
                "terminal_accounts_count": 0,
                "unresolved_trace_amount": 0.0,
            },
            "graph": {"nodes": [], "edges": []},
            "accounts_summary": [],
            "transactions": [],
            "terminal_accounts": [],
            "broken_links_and_gaps": [],
            "suggested_actions": [],
        }

    # ------------------------------------------------------------
    # 1. CANONICAL TRANSACTION INGESTION ACROSS WORKSHEETS
    # ------------------------------------------------------------
    raw_transfers: List[Dict[str, Any]] = []
    account_holds = defaultdict(float)
    account_hold_records = defaultdict(list)
    account_withdrawals = defaultdict(float)
    account_withdrawal_records = defaultdict(list)
    account_metadata: Dict[str, Dict[str, Any]] = {}

    def get_or_create_meta(acc: str) -> Dict[str, Any]:
        if acc not in account_metadata:
            account_metadata[acc] = {
                "account": acc,
                "masked_account": mask_account_number(acc),
                "bank": "Unknown Bank",
                "holder_name": "Not provided",
                "ifsc": "Not provided",
                "ack_no": None,
                "first_date": None,
                "last_date": None,
            }
        return account_metadata[acc]

    for tx in all_txs:
        raw = tx.raw_data or {}
        sheet = (tx.sheet_name or "").lower()
        amt = float(tx.transaction_amount or parse_clean_amount(extract_field(raw, ["Transaction Amount", "Amount", "Withdrawal Amount", "Put on Hold Amount"])))
        disp_amt = float(tx.disputed_amount or parse_clean_amount(extract_field(raw, ["Disputed Amount", "Disputed", "Put on Hold Amount"])))
        dt_val = tx.transaction_date
        d_clean, dt_clean = parse_ncrp_datetime_string(dt_val or extract_field(raw, [
            "Transaction Date", "Transaction Date & Time", "Date & Time", "Date",
            "Withdrawal Date & Time", "Put on Hold Date", "Action Date"
        ]))
        primary_acc = normalize_account_identifier(
            tx.account_or_wallet_id or extract_field(raw, [
                "Account No./ (Wallet /PG/PA) Id", "Account No / Wallet / PG / PA Id",
                "Account No", "Suspect Account No", "Sender Account No", "From Account"
            ])
        )
        layer_raw = str(tx.layer or extract_field(raw, ["Layer", "Hop", "Level"]) or "")
        digits = "".join(c for c in layer_raw if c.isdigit())
        layer_num = int(digits) if digits else 1

        ack = str(tx.acknowledgement_no or extract_field(raw, ["Acknowledgement No.", "Acknowledgement No", "Ack No"]) or "").strip() or None

        # Process Holds
        if "hold" in sheet:
            h_acc = primary_acc or normalize_account_identifier(extract_field(raw, ["Account No", "Beneficiary Account No"]))
            if h_acc:
                account_holds[h_acc] += amt
                account_hold_records[h_acc].append({
                    "tx_id": tx.id,
                    "amount": amt,
                    "date": d_clean,
                    "bank": tx.bank_name or extract_field(raw, ["Action Taken By bank", "Bank/FIs", "Bank Name"]),
                    "utr": tx.transaction_id_utr or extract_field(raw, ["Transaction ID / UTR Number", "UTR"]),
                    "raw": raw,
                })
                meta = get_or_create_meta(h_acc)
                if meta["bank"] == "Unknown Bank" and tx.bank_name:
                    meta["bank"] = tx.bank_name

        # Process Dispersals / Cash-outs (ATM, POS, Cheque)
        elif any(k in sheet for k in ["atm", "pos", "cheque", "check"]):
            w_acc = primary_acc or normalize_account_identifier(extract_field(raw, ["Account No", "Beneficiary Account No"]))
            w_type = "ATM" if "atm" in sheet else ("POS" if "pos" in sheet else "CHEQUE")
            if w_acc:
                account_withdrawals[w_acc] += amt
                account_withdrawal_records[w_acc].append({
                    "tx_id": tx.id,
                    "type": w_type,
                    "amount": amt,
                    "date": d_clean,
                    "datetime": dt_clean,
                    "terminal_or_merchant": extract_field(raw, ["ATM ID", "Location", "MID", "Terminal ID", "Merchant Name", "Cheque No"]),
                    "bank": tx.bank_name or extract_field(raw, ["Bank/FIs", "Action Taken By bank"]),
                })
                meta = get_or_create_meta(w_acc)
                if meta["bank"] == "Unknown Bank" and tx.bank_name:
                    meta["bank"] = tx.bank_name

        # Process Money Transfers
        elif "transfer" in sheet or "money transfer" in sheet or tx.sheet_name == "Money Transfer to":
            dest_acc = normalize_account_identifier(
                extract_field(raw, ["Account No", "Beneficiary Account No", "Target Account", "Receiver Account No"])
            )
            # If primary and dest are equal, check if raw sender was recorded under another key
            if primary_acc and dest_acc and primary_acc == dest_acc:
                sender_cand = normalize_account_identifier(extract_field(raw, ["Sender Account No", "From Account", "Suspect Account No"]))
                if sender_cand and sender_cand != dest_acc:
                    primary_acc = sender_cand

            action_bank = extract_field(raw, ["Action Taken By bank", "action_taken_by_bank", "Sender Bank", "Source Bank", "From Bank"])
            bene_bank = extract_field(raw, ["Bank/FIs", "Beneficiary Bank", "Receiver Bank", "Target Bank", "To Bank"])
            s_bank = str(action_bank or extract_field(raw, ["Bank Name", "Bank"]) or tx.bank_name or "Unknown Bank").strip()
            d_bank = str(bene_bank or tx.bank_name or extract_field(raw, ["Bank Name", "Bank"]) or s_bank).strip()

            utr = tx.transaction_id_utr or extract_field(raw, ["Transaction ID / UTR Number", "Transaction Id / UTR Number", "transfer_utr", "UTR", "Reference No"])
            utr_str = str(utr).strip() if utr else None

            remarks = extract_field(raw, ["Remarks", "Action Remarks", "Transaction Description", "Description", "Narration"]) or ""
            holder = extract_field(raw, ["Account Holder Name", "Account Name", "Customer Name", "Beneficiary Name", "Favoring", "Name of Acc Holder"]) or "Not provided"
            ifsc_val = extract_field(raw, ["IFSC", "ifsc", "IFSC Code", "Branch IFSC"]) or "Not provided"

            raw_transfers.append({
                "tx_id": tx.id,
                "row_number": tx.row_number,
                "sheet_name": tx.sheet_name,
                "sender_account": primary_acc,
                "beneficiary_account": dest_acc,
                "sender_bank": s_bank,
                "source_bank": s_bank,
                "dest_bank": d_bank,
                "beneficiary_bank": d_bank,
                "amount": amt,
                "disputed_amount": disp_amt or amt,
                "utr": utr_str,
                "date": d_clean,
                "datetime": dt_clean,
                "layer_recorded": layer_num,
                "acknowledgement_no": ack,
                "remarks": remarks,
                "holder_name": str(holder).strip(),
                "ifsc": str(ifsc_val).strip(),
                "raw": raw,
            })

            # Update account metadata
            if primary_acc:
                sm = get_or_create_meta(primary_acc)
                if sm["bank"] == "Unknown Bank" and s_bank != "Unknown Bank":
                    sm["bank"] = s_bank
                if ack and not sm["ack_no"]:
                    sm["ack_no"] = ack
                if d_clean:
                    if not sm["first_date"] or d_clean < sm["first_date"]:
                        sm["first_date"] = d_clean
                    if not sm["last_date"] or d_clean > sm["last_date"]:
                        sm["last_date"] = d_clean

            if dest_acc:
                dm = get_or_create_meta(dest_acc)
                if dm["bank"] == "Unknown Bank" and d_bank != "Unknown Bank":
                    dm["bank"] = d_bank
                if holder != "Not provided" and dm["holder_name"] == "Not provided":
                    dm["holder_name"] = str(holder).strip()
                if ifsc_val != "Not provided" and dm["ifsc"] == "Not provided":
                    dm["ifsc"] = str(ifsc_val).strip()
                if ack and not dm["ack_no"]:
                    dm["ack_no"] = ack
                if d_clean:
                    if not dm["first_date"] or d_clean < dm["first_date"]:
                        dm["first_date"] = d_clean
                    if not dm["last_date"] or d_clean > dm["last_date"]:
                        dm["last_date"] = d_clean

    # ------------------------------------------------------------
    # 2. IDENTIFY LAYER 1 STARTING SUSPECT ACCOUNTS
    # ------------------------------------------------------------
    l1_candidates: Dict[str, Dict[str, Any]] = {}
    for tr in raw_transfers:
        s_acc = tr["sender_account"]
        if tr["layer_recorded"] == 1 and s_acc:
            if s_acc not in l1_candidates:
                l1_candidates[s_acc] = {
                    "account": s_acc,
                    "masked_account": mask_account_number(s_acc),
                    "bank": tr["sender_bank"],
                    "total_outflow": 0.0,
                    "outflow_count": 0,
                    "layer": 1,
                }
            l1_candidates[s_acc]["total_outflow"] += tr["amount"]
            l1_candidates[s_acc]["outflow_count"] += 1

    # Fallback if no explicit Layer 1 marked: find root accounts with no incoming transfers
    if not l1_candidates:
        all_senders = set(tr["sender_account"] for tr in raw_transfers if tr["sender_account"])
        all_receivers = set(tr["beneficiary_account"] for tr in raw_transfers if tr["beneficiary_account"])
        roots = all_senders - all_receivers
        if not roots:
            roots = all_senders
        for r_acc in roots:
            l1_candidates[r_acc] = {
                "account": r_acc,
                "masked_account": mask_account_number(r_acc),
                "bank": account_metadata.get(r_acc, {}).get("bank", "Unknown Bank"),
                "total_outflow": sum(t["amount"] for t in raw_transfers if t["sender_account"] == r_acc),
                "outflow_count": sum(1 for t in raw_transfers if t["sender_account"] == r_acc),
                "layer": 1,
            }

    starting_accounts_list = sorted(
        l1_candidates.values(),
        key=lambda x: (x["total_outflow"], x["outflow_count"]),
        reverse=True,
    )

    # ------------------------------------------------------------
    # 3. GRAPH TRAVERSAL & SUBGRAPH SELECTION (WITH CYCLE DETECTION)
    # ------------------------------------------------------------
    # Determine active starting account scope
    active_starting = None
    if starting_account and starting_account.strip().upper() not in {"ALL", ""}:
        clean_selected = normalize_account_identifier(starting_account)
        if clean_selected in [sa["account"] for sa in starting_accounts_list]:
            active_starting = clean_selected

    # Build adjacency lists from transfers
    # Deduplicate multiple identical edges (same UTR, same source, same dest, same amount)
    adj_out = defaultdict(list)
    seen_transfer_fps = set()
    deduped_transfers: List[Dict[str, Any]] = []

    for tr in raw_transfers:
        s = tr["sender_account"] or "UNSPECIFIED"
        d = tr["beneficiary_account"] or "UNSPECIFIED"
        amt_r = round(tr["amount"], 2)
        utr_val = tr["utr"] or ""
        fp = (tr["sheet_name"], tr["row_number"], s, d, amt_r, utr_val)
        if fp in seen_transfer_fps:
            continue
        seen_transfer_fps.add(fp)

        # Missing or conflicting fields audit
        missing_fields = []
        if not _is_valid_utr(utr_val):
            missing_fields.append("UTR / Transaction Reference number unrecorded or pending confirmation")
        if not tr["beneficiary_account"] or tr["beneficiary_account"] == "UNSPECIFIED":
            missing_fields.append("Beneficiary account number missing")
        if not tr["sender_account"] or tr["sender_account"] == "UNSPECIFIED":
            missing_fields.append("Sender account number missing")
        if tr["dest_bank"] in {"Unknown Bank", "", None}:
            missing_fields.append("Beneficiary bank / institution name not identified")
        if tr["sender_bank"] in {"Unknown Bank", "", None}:
            missing_fields.append("Sender bank name not identified")
        if not tr["date"]:
            missing_fields.append("Transaction date unrecorded")

        # Determine Link Confidence Level & Rationale (Section 4 of prompt)
        evidence_points = []
        rationale = ""
        if _is_valid_utr(utr_val) and s != "UNSPECIFIED" and d != "UNSPECIFIED":
            link_status = "CONFIRMED"
            rationale = "Strong source evidence: exact matching UTR/Reference with source-confirmed remitter and beneficiary accounts."
            evidence_points.append(f"Exact UTR/Reference match: {utr_val}")
            evidence_points.append("Source-confirmed inter-bank clearing record")
        elif s != "UNSPECIFIED" and d != "UNSPECIFIED" and tr["dest_bank"] != "Unknown Bank":
            link_status = "POSSIBLE"
            rationale = "Direct remitter-to-beneficiary relationship recorded in worksheet, but clearing UTR is unconfirmed or pending."
            evidence_points.append("Direct sender-to-beneficiary mapping recorded in worksheet")
            evidence_points.append("UTR/Reference number unconfirmed or missing")
        else:
            link_status = "UNVERIFIED"
            rationale = "Relationship is ambiguous, unlinked, or lacks essential party/account identifiers."
            evidence_points.append("Incomplete account identifiers or ambiguous party details")

        evidence_points.append(f"Worksheet: {tr['sheet_name']}, Row: {tr['row_number']}")
        if tr["remarks"]:
            evidence_points.append(f"Narration: {tr['remarks']}")

        tr["link_status"] = link_status
        tr["rationale"] = rationale
        tr["evidence"] = evidence_points
        tr["missing_fields"] = missing_fields
        deduped_transfers.append(tr)
        adj_out[s].append(tr)

    # Multi-path traversal with cycle detection
    # Each entry in queue: (account, current_depth, current_path_set)
    reached_accounts: Set[str] = set()
    node_layers: Dict[str, int] = {}
    included_transfers: List[Dict[str, Any]] = []
    included_tx_ids: Set[int] = set()

    if active_starting:
        root_nodes = [active_starting]
    else:
        root_nodes = [sa["account"] for sa in starting_accounts_list] if starting_accounts_list else list(adj_out.keys())[:1]

    queue = deque()
    for root in root_nodes:
        if root:
            queue.append((root, 1, {root}))
            node_layers[root] = 1
            reached_accounts.add(root)

    while queue:
        curr_acc, curr_layer, path_set = queue.popleft()
        if curr_layer >= max_depth:
            continue

        for tr in adj_out.get(curr_acc, []):
            dest = tr["beneficiary_account"]
            if not dest or dest == "UNSPECIFIED":
                if tr["tx_id"] not in included_tx_ids:
                    tr["inferred_layer_from"] = curr_layer
                    tr["inferred_layer_to"] = curr_layer + 1
                    tr["is_cycle"] = False
                    included_transfers.append(tr)
                    included_tx_ids.add(tr["tx_id"])
                continue

            is_cycle = dest in path_set
            if tr["tx_id"] not in included_tx_ids:
                tr["inferred_layer_from"] = curr_layer
                tr["inferred_layer_to"] = curr_layer + 1 if not is_cycle else node_layers.get(dest, curr_layer)
                tr["is_cycle"] = is_cycle
                included_transfers.append(tr)
                included_tx_ids.add(tr["tx_id"])

            if not is_cycle:
                new_path_set = set(path_set)
                new_path_set.add(dest)
                reached_accounts.add(dest)
                if dest not in node_layers or (curr_layer + 1 < node_layers[dest]):
                    node_layers[dest] = curr_layer + 1
                queue.append((dest, curr_layer + 1, new_path_set))

    # If root accounts was empty or no graph, include all transfers safely
    if not included_transfers and deduped_transfers:
        included_transfers = deduped_transfers
        for tr in included_transfers:
            tr["inferred_layer_from"] = tr.get("layer_recorded", 1)
            tr["inferred_layer_to"] = tr.get("layer_recorded", 1) + 1
            tr["is_cycle"] = False
            s = tr["sender_account"]
            d = tr["beneficiary_account"]
            if s:
                reached_accounts.add(s)
                node_layers[s] = tr.get("layer_recorded", 1)
            if d:
                reached_accounts.add(d)
                node_layers[d] = tr.get("layer_recorded", 1) + 1

    # ------------------------------------------------------------
    # 4. ACCOUNT-LEVEL FINANCIAL SUMMARIES & CLASSIFICATION
    # ------------------------------------------------------------
    acc_incoming_sum = defaultdict(float)
    acc_incoming_count = defaultdict(int)
    acc_outgoing_sum = defaultdict(float)
    acc_outgoing_count = defaultdict(int)
    acc_last_incoming_tx: Dict[str, Dict[str, Any]] = {}

    for tr in included_transfers:
        s = tr["sender_account"]
        d = tr["beneficiary_account"]
        amt = tr["amount"]

        if s:
            acc_outgoing_sum[s] += amt
            acc_outgoing_count[s] += 1
        if d:
            acc_incoming_sum[d] += amt
            acc_incoming_count[d] += 1
            # Track latest incoming transaction
            if d not in acc_last_incoming_tx or (tr["date"] and (acc_last_incoming_tx[d].get("date") or "") <= (tr["date"] or "")):
                acc_last_incoming_tx[d] = tr

    accounts_summary_list: List[Dict[str, Any]] = []
    terminal_accounts_list: List[Dict[str, Any]] = []
    terminal_acc_set: Set[str] = set()

    for acc in sorted(reached_accounts):
        meta = account_metadata.get(acc, {})
        layer = node_layers.get(acc, 1)
        in_amt = round(acc_incoming_sum.get(acc, 0.0), 2)
        out_amt = round(acc_outgoing_sum.get(acc, 0.0), 2)
        in_cnt = acc_incoming_count.get(acc, 0)
        out_cnt = acc_outgoing_count.get(acc, 0)
        held_amt = round(account_holds.get(acc, 0.0), 2)
        withdrawn_amt = round(account_withdrawals.get(acc, 0.0), 2)

        # Net movement & unresolved amount
        net_mov = round(in_amt - out_amt, 2)
        # Unresolved amount: funds received that neither left onwards, nor are secured by hold, nor cashed out
        unresolved_amt = max(0.0, round(in_amt - out_amt - held_amt - withdrawn_amt, 2)) if in_amt > 0 else 0.0

        is_term = (out_cnt == 0 and in_cnt > 0)
        is_unverified = (not acc or acc == "UNSPECIFIED" or "unknown" in acc.lower())
        is_trace_gap = (meta.get("bank") == "Unknown Bank" and in_cnt == 0 and out_cnt == 0)

        # Classify Role (Section 5 of prompt)
        if is_unverified:
            role = "Unverified Account"
        elif is_trace_gap:
            role = "Trace Gap"
        elif in_cnt == 0 and out_cnt > 0:
            role = "Starting Account"
        elif is_term:
            role = "Terminal Account"
        else:
            role = "Intermediary Account"

        terminal_status = None
        reason_trace_ends = None
        suggested_step = None

        if is_term:
            terminal_acc_set.add(acc)
            # Determine specific terminal status (Section 8 of prompt)
            if is_unverified:
                terminal_status = "Unverified Terminal"
                reason_trace_ends = f"Incomplete or unverified account details recorded at Layer {layer}."
                suggested_step = f"Notice to preceding remitting bank to furnish verified beneficiary account number and core banking statement."
            elif withdrawn_amt > 0 and unresolved_amt == 0:
                terminal_status = "Possible Cash-Out — Evidence Required"
                reason_trace_ends = f"Recorded cash-out withdrawals of ₹{withdrawn_amt:,.2f} via ATM/POS/Cheque. Funds dispersed from banking channel."
                suggested_step = f"Request ATM CCTV footage, POS terminal settlement logs, or physical cheque vouchers from {meta.get('bank', 'relevant bank')}."
            elif meta.get("bank") in {"Unknown Bank", "", None}:
                terminal_status = "Trace Ends — Missing Transaction Data"
                reason_trace_ends = f"Beneficiary bank details missing in NCRP records for Layer {layer} account {mask_account_number(acc)}."
                suggested_step = "Request remitting bank to provide destination clearing IFSC and beneficiary bank name."
            else:
                terminal_status = "Terminal — No Further Outgoing Record"
                reason_trace_ends = f"No further outgoing transfers recorded in NCRP workbook. Trail ends with ₹{unresolved_amt:,.2f} recorded in account."
                suggested_step = f"Request complete account statement and account opening documentation from {meta.get('bank', 'beneficiary bank')}."

            last_in_tx = acc_last_incoming_tx.get(acc, {})
            terminal_accounts_list.append({
                "account": acc,
                "masked_account": mask_account_number(acc),
                "bank": meta.get("bank", "Unknown Bank"),
                "holder_name": meta.get("holder_name", "Not provided"),
                "layer": layer,
                "total_incoming": in_amt,
                "total_outgoing": out_amt,
                "held_amount": held_amt,
                "withdrawn_amount": withdrawn_amt,
                "unresolved_amount": unresolved_amt,
                "terminal_status": terminal_status,
                "reason_trace_ends": reason_trace_ends,
                "suggested_next_step": suggested_step,
                "last_incoming_tx": {
                    "amount": last_in_tx.get("amount", 0.0),
                    "date": last_in_tx.get("date") or "Not available",
                    "utr": last_in_tx.get("utr") or "Not available",
                    "sender_account": last_in_tx.get("sender_account", "Not available"),
                    "sender_masked": mask_account_number(last_in_tx.get("sender_account")),
                    "sender_bank": last_in_tx.get("sender_bank", "Unknown Bank"),
                } if last_in_tx else None,
            })

        acc_summary = {
            "account": acc,
            "masked_account": mask_account_number(acc),
            "bank": meta.get("bank", "Unknown Bank"),
            "holder_name": meta.get("holder_name", "Not provided"),
            "ifsc": meta.get("ifsc", "Not provided"),
            "layer": layer,
            "role": role,
            "is_terminal": is_term,
            "terminal_status": terminal_status,
            "total_incoming": in_amt,
            "total_outgoing": out_amt,
            "incoming_count": in_cnt,
            "outgoing_count": out_cnt,
            "net_movement": net_mov,
            "held_amount": held_amt,
            "withdrawn_amount": withdrawn_amt,
            "unresolved_amount": unresolved_amt,
            "last_recorded_date": meta.get("last_date") or meta.get("first_date") or "Not available",
        }
        accounts_summary_list.append(acc_summary)

    # ------------------------------------------------------------
    # 5. BROKEN LINKS AND INVESTIGATION GAPS AUDIT (SECTION 7)
    # ------------------------------------------------------------
    gaps_list: List[Dict[str, Any]] = []
    gap_counter = 1

    # Gap Type 1: Missing UTR on transfers
    for tr in included_transfers:
        if not _is_valid_utr(tr["utr"]):
            gaps_list.append({
                "gap_id": f"GAP-{gap_counter:03d}",
                "related_account": tr["beneficiary_account"] or tr["sender_account"] or "Unknown",
                "masked_account": mask_account_number(tr["beneficiary_account"] or tr["sender_account"]),
                "bank": tr["dest_bank"],
                "layer": tr.get("inferred_layer_to", tr.get("layer_recorded", 1)),
                "issue_type": "Missing UTR / Transaction Reference",
                "evidence_available": f"Amount ₹{tr['amount']:,.2f} recorded on {tr['date'] or 'unspecified date'} without clearing UTR.",
                "why_trail_cannot_be_confirmed": "Absence of inter-bank UTR prevents statutory confirmation of credit in beneficiary core banking system.",
                "suggested_action": f"Summon remitting bank ({tr['source_bank']}) to furnish IMPS/NEFT/RTGS clearing logs and UTR number.",
            })
            gap_counter += 1

    # Gap Type 2: Terminal accounts with unresolved funds (Statement Gaps)
    for term in terminal_accounts_list:
        if term["unresolved_amount"] > 0:
            gaps_list.append({
                "gap_id": f"GAP-{gap_counter:03d}",
                "related_account": term["account"],
                "masked_account": term["masked_account"],
                "bank": term["bank"],
                "layer": term["layer"],
                "issue_type": "Unresolved Trail / Missing Beneficiary Statement",
                "evidence_available": f"Account received ₹{term['total_incoming']:,.2f} with ₹{term['unresolved_amount']:,.2f} unaccounted for by holds or cash-outs.",
                "why_trail_cannot_be_confirmed": "NCRP workbook does not contain further downstream transfer records for this beneficiary.",
                "suggested_action": f"Requisition complete account statement of {term['masked_account']} from {term['bank']} u/s 91 CrPC for subsequent 30 days.",
            })
            gap_counter += 1

    # Gap Type 3: Cash withdrawals without CCTV / Merchant vouchers
    for acc in sorted(reached_accounts):
        w_records = account_withdrawal_records.get(acc, [])
        if w_records:
            total_w = sum(r["amount"] for r in w_records)
            gaps_list.append({
                "gap_id": f"GAP-{gap_counter:03d}",
                "related_account": acc,
                "masked_account": mask_account_number(acc),
                "bank": account_metadata.get(acc, {}).get("bank", "Unknown Bank"),
                "layer": node_layers.get(acc, 1),
                "issue_type": "Dispersal Activity / Physical Evidence Required",
                "evidence_available": f"{len(w_records)} withdrawal events totaling ₹{total_w:,.2f} recorded in workbook.",
                "why_trail_cannot_be_confirmed": "Worksheet lists cash-out but physical ATM CCTV footage, merchant invoice, or instrument voucher is not linked.",
                "suggested_action": "Subpoena ATM CCTV footage, terminal journal logs, or physical cheque voucher to identify perpetrator.",
            })
            gap_counter += 1

    # ------------------------------------------------------------
    # 6. SUGGESTED INVESTIGATIVE ACTIONS (SECTION 8)
    # ------------------------------------------------------------
    suggested_actions_list: List[Dict[str, Any]] = []
    action_counter = 1

    # Action 1: High priority notices to banks for terminal accounts with unresolved balance
    for term in sorted(terminal_accounts_list, key=lambda x: x["unresolved_amount"], reverse=True):
        if term["unresolved_amount"] > 0 and term["bank"] != "Unknown Bank":
            suggested_actions_list.append({
                "action_id": f"ACT-{action_counter:03d}",
                "priority": "HIGH" if term["layer"] <= 3 else "MEDIUM",
                "category": "STATEMENT_REQUISITION",
                "target_bank": term["bank"],
                "target_account": term["account"],
                "masked_account": term["masked_account"],
                "action_title": f"Requisition Account Statement from {term['bank']}",
                "action_detail": f"Issue Notice u/s 91 CrPC to {term['bank']} to furnish full bank statement, account opening form, KYC mandate, and registered mobile/email for account {term['masked_account']} (Unresolved: ₹{term['unresolved_amount']:,.2f}).",
                "legal_basis": "Section 91 CrPC / Section 94 BNSS",
                "evidence_ground": f"Terminal endpoint at Layer {term['layer']} with unaccounted fund movement.",
            })
            action_counter += 1

    # Action 2: Cash-out subpoena for ATM/POS/Cheque
    for acc in sorted(reached_accounts):
        w_amt = account_withdrawals.get(acc, 0.0)
        if w_amt > 0:
            b_name = account_metadata.get(acc, {}).get("bank", "Relevant Bank")
            suggested_actions_list.append({
                "action_id": f"ACT-{action_counter:03d}",
                "priority": "HIGH",
                "category": "CASH_OUT_SUBPOENA",
                "target_bank": b_name,
                "target_account": acc,
                "masked_account": mask_account_number(acc),
                "action_title": f"Subpoena Terminal CCTV & Merchant Logs from {b_name}",
                "action_detail": f"Issue statutory notice to {b_name} and respective payment gateway / ATM acquirer to preserve and provide ATM CCTV recordings, switch logs, and merchant invoices for ₹{w_amt:,.2f} dispersed.",
                "legal_basis": "Section 91 CrPC & Section 65B Indian Evidence Act / BSA",
                "evidence_ground": f"Cash withdrawal activity detected at Layer {node_layers.get(acc, 1)}.",
            })
            action_counter += 1

    # Action 3: UTR reconciliations for unconfirmed transfers
    seen_recon_banks = set()
    for tr in included_transfers:
        if not _is_valid_utr(tr["utr"]) and tr["dest_bank"] not in seen_recon_banks and tr["dest_bank"] != "Unknown Bank":
            seen_recon_banks.add(tr["dest_bank"])
            suggested_actions_list.append({
                "action_id": f"ACT-{action_counter:03d}",
                "priority": "MEDIUM",
                "category": "UTR_RECONCILIATION",
                "target_bank": tr["source_bank"],
                "target_account": tr["sender_account"] or "Source Account",
                "masked_account": mask_account_number(tr["sender_account"]),
                "action_title": f"Reconcile Inter-Bank UTR with {tr['source_bank']}",
                "action_detail": f"Requisition transaction audit trail and core-banking UTR from {tr['source_bank']} for fund transfer to {tr['dest_bank']} (A/c {mask_account_number(tr['beneficiary_account'])}).",
                "legal_basis": "Section 91 CrPC / Section 94 BNSS",
                "evidence_ground": f"Unconfirmed UTR on Layer {tr.get('inferred_layer_from', 1)} transfer of ₹{tr['amount']:,.2f}.",
            })
            action_counter += 1

    # Action 4: Follow-up on verified holds
    for acc in sorted(reached_accounts):
        h_amt = account_holds.get(acc, 0.0)
        if h_amt > 0:
            b_name = account_metadata.get(acc, {}).get("bank", "Bank")
            suggested_actions_list.append({
                "action_id": f"ACT-{action_counter:03d}",
                "priority": "MEDIUM",
                "category": "LIEN_CONFIRMATION",
                "target_bank": b_name,
                "target_account": acc,
                "masked_account": mask_account_number(acc),
                "action_title": f"Formalize Judicial Attachment of ₹{h_amt:,.2f} at {b_name}",
                "action_detail": f"Submit report to Magistrate u/s 102(3) CrPC / Section 106(3) BNSS regarding freeze of ₹{h_amt:,.2f} in account {mask_account_number(acc)} and serve formal seizure order on {b_name}.",
                "legal_basis": "Section 102 CrPC / Section 106 BNSS",
                "evidence_ground": f"Bank lien of ₹{h_amt:,.2f} verified in NCRP records.",
            })
            action_counter += 1

    # ------------------------------------------------------------
    # 7. SUMMARY KPIS (SECTION 9.A)
    # ------------------------------------------------------------
    # Unique entry inflow: sum of Layer 1 starting transfers
    l1_entry_txs = [t for t in included_transfers if t.get("inferred_layer_from") == 1]
    total_recorded_inflow = round(sum(t["amount"] for t in l1_entry_txs), 2)
    if total_recorded_inflow == 0.0 and included_transfers:
        total_recorded_inflow = round(included_transfers[0]["amount"], 2)

    total_recorded_outflow = round(sum(t["amount"] for t in included_transfers), 2)
    confirmed_links_count = sum(1 for t in included_transfers if t["link_status"] == "CONFIRMED")
    possible_links_count = sum(1 for t in included_transfers if t["link_status"] == "POSSIBLE")
    unverified_links_count = sum(1 for t in included_transfers if t["link_status"] == "UNVERIFIED")

    # Unmatched transactions in workbook not linked to fund-flow graph
    unmatched_transfers = [t for t in deduped_transfers if t["tx_id"] not in included_tx_ids]
    unmatched_count = len(unmatched_transfers)
    unverified_unmatched_count = unverified_links_count + unmatched_count

    unresolved_trace_amount = round(sum(term["unresolved_amount"] for term in terminal_accounts_list), 2)

    summary_kpis = {
        "total_ncrp_transactions": len(all_txs),
        "total_recorded_inflow": total_recorded_inflow,
        "total_recorded_outflow": total_recorded_outflow,
        "distinct_accounts_count": len(reached_accounts),
        "confirmed_links_count": confirmed_links_count,
        "possible_links_count": possible_links_count,
        "unverified_links_count": unverified_links_count,
        "unmatched_transactions_count": unmatched_count,
        "unverified_unmatched_count": unverified_unmatched_count,
        "terminal_accounts_count": len(terminal_accounts_list),
        "unresolved_trace_amount": unresolved_trace_amount,
    }

    # ------------------------------------------------------------
    # 8. INTERACTIVE GRAPH DATA (SECTION 9.B)
    # ------------------------------------------------------------
    graph_nodes = []
    for acc in sorted(reached_accounts):
        meta = account_metadata.get(acc, {})
        layer = node_layers.get(acc, 1)
        in_amt = round(acc_incoming_sum.get(acc, 0.0), 2)
        out_amt = round(acc_outgoing_sum.get(acc, 0.0), 2)
        h_amt = round(account_holds.get(acc, 0.0), 2)
        w_amt = round(account_withdrawals.get(acc, 0.0), 2)
        unres = max(0.0, round(in_amt - out_amt - h_amt - w_amt, 2)) if in_amt > 0 else 0.0
        is_term = acc in terminal_acc_set

        term_info = next((t for t in terminal_accounts_list if t["account"] == acc), None)
        term_stat = term_info["terminal_status"] if term_info else None

        is_unverified = (not acc or acc == "UNSPECIFIED" or "unknown" in acc.lower())
        is_trace_gap = (meta.get("bank") == "Unknown Bank" and in_amt == 0 and out_amt == 0)

        if is_unverified:
            role = "Unverified Account"
        elif is_trace_gap:
            role = "Trace Gap"
        elif in_amt == 0 and out_amt > 0:
            role = "Starting Account"
        elif is_term:
            role = "Terminal Account"
        else:
            role = "Intermediary Account"

        graph_nodes.append({
            "id": acc,
            "account": acc,
            "masked_account": mask_account_number(acc),
            "bank": meta.get("bank", "Unknown Bank"),
            "holder_name": meta.get("holder_name", "Not provided"),
            "layer": layer,
            "role": role,
            "is_terminal": is_term,
            "terminal_status": term_stat,
            "total_incoming": in_amt,
            "total_outgoing": out_amt,
            "held_amount": h_amt,
            "withdrawn_amount": w_amt,
            "unresolved_amount": unres,
            "tx_count": acc_incoming_count.get(acc, 0) + acc_outgoing_count.get(acc, 0),
            "last_transaction_date": meta.get("last_date") or meta.get("first_date") or "Not available",
        })

    graph_edges = []
    for tr in included_transfers:
        s = tr["sender_account"] or "UNSPECIFIED"
        d = tr["beneficiary_account"] or "UNSPECIFIED"
        edge_id = f"edge_{tr['tx_id']}_{tr['row_number']}"
        graph_edges.append({
            "id": edge_id,
            "source": s,
            "target": d,
            "amount": tr["amount"],
            "disputed_amount": tr["disputed_amount"],
            "utr": tr["utr"] or "Not available",
            "date": tr["date"] or "Not available",
            "datetime": tr["datetime"] or tr["date"] or "Not available",
            "source_bank": tr["source_bank"],
            "dest_bank": tr["dest_bank"],
            "layer_from": tr.get("inferred_layer_from", tr.get("layer_recorded", 1)),
            "layer_to": tr.get("inferred_layer_to", tr.get("layer_recorded", 1) + 1),
            "status": tr["link_status"],
            "is_cycle": tr.get("is_cycle", False),
            "evidence": tr["evidence"],
            "rationale": tr.get("rationale", ""),
            "missing_fields": tr.get("missing_fields", []),
            "remarks": tr["remarks"] or "Direct fund transfer",
            "source_sheet": tr["sheet_name"],
            "source_row": tr["row_number"],
            "tx_id": tr["tx_id"],
        })

    # ------------------------------------------------------------
    # 9. TRANSACTION-LEVEL TABLE ROWS (SECTION 9.C)
    # ------------------------------------------------------------
    transaction_rows = []
    for tr in included_transfers:
        transaction_rows.append({
            "id": tr["tx_id"],
            "row_number": tr["row_number"],
            "source_sheet": tr["sheet_name"],
            "date": tr["date"] or "Not available",
            "datetime": tr["datetime"] or tr["date"] or "Not available",
            "utr": tr["utr"] or "Not available",
            "sender_account": tr["sender_account"] or "UNSPECIFIED",
            "sender_masked": mask_account_number(tr["sender_account"]),
            "sender_bank": tr["source_bank"],
            "beneficiary_account": tr["beneficiary_account"] or "UNSPECIFIED",
            "beneficiary_masked": mask_account_number(tr["beneficiary_account"]),
            "dest_bank": tr["dest_bank"],
            "amount": tr["amount"],
            "direction": "OUTBOUND",
            "layer": f"Layer {tr.get('inferred_layer_from', tr.get('layer_recorded', 1))}",
            "layer_num": tr.get("inferred_layer_from", tr.get("layer_recorded", 1)),
            "target_layer_num": tr.get("inferred_layer_to", tr.get("layer_recorded", 1) + 1),
            "link_status": tr["link_status"],
            "rationale": tr.get("rationale", ""),
            "evidence": tr.get("evidence", []),
            "missing_fields": tr.get("missing_fields", []),
            "remarks": tr["remarks"] or "Direct transfer",
            "acknowledgement_no": tr["acknowledgement_no"] or "Not available",
        })

    return {
        "file_id": file_id,
        "case_id": case_id or 0,
        "filename": filename,
        "generated_at": now_iso,
        "report_title": "NCRP Fund Flow Traceability Report",
        "starting_accounts": starting_accounts_list,
        "selected_starting_account": active_starting or "ALL",
        "summary_kpis": summary_kpis,
        "graph": {
            "nodes": graph_nodes,
            "edges": graph_edges,
        },
        "accounts_summary": accounts_summary_list,
        "transactions": transaction_rows,
        "terminal_accounts": terminal_accounts_list,
        "broken_links_and_gaps": gaps_list,
        "suggested_actions": suggested_actions_list,
    }

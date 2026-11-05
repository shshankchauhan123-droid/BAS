"""
NCRP Account Activity & Exit Report Service (Report 07).
Comprehensive forensic analysis of suspicious account fund movements, transaction timing,
rapid exit velocity, destination account mapping, and last traceable activity.
"""

from collections import defaultdict
import datetime
from decimal import Decimal
import math
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
    """Check if UTR is a valid transaction reference rather than a placeholder."""
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


def _parse_timestamp(dt_obj: Any) -> Optional[datetime.datetime]:
    """Ensure datetime has UTC timezone."""
    if not dt_obj:
        return None
    if isinstance(dt_obj, datetime.datetime):
        if dt_obj.tzinfo is None:
            return dt_obj.replace(tzinfo=datetime.timezone.utc)
        return dt_obj.astimezone(datetime.timezone.utc)
    return None


def get_ncrp_workbook_accounts(
    db: Session,
    file_id: int,
    case_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Retrieve all distinct accounts present across all worksheets of an NCRP workbook.
    Identifies senders, receivers, withdrawal accounts, hold accounts, and their layers.
    """
    file_obj = db.query(NcrpFile).filter(NcrpFile.id == file_id).first()
    filename = file_obj.original_filename if file_obj else f"File #{file_id}"

    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    accounts_map: Dict[str, Dict[str, Any]] = {}
    incoming_counts = defaultdict(int)
    outgoing_counts = defaultdict(int)

    for tx in all_txs:
        raw = tx.raw_data or {}
        sheet = (tx.sheet_name or "").lower()

        primary_acc = normalize_account_identifier(
            tx.account_or_wallet_id or extract_field(raw, [
                "Account No./ (Wallet /PG/PA) Id", "Account No / Wallet / PG / PA Id",
                "Account No", "Suspect Account No", "Sender Account No", "From Account"
            ])
        )

        layer_raw = str(tx.layer or extract_field(raw, ["Layer", "Hop", "Level"]) or "")
        digits = "".join(c for c in layer_raw if c.isdigit())
        layer_num = int(digits) if digits else 1

        action_bank = extract_field(raw, ["Action Taken By bank", "action_taken_by_bank", "Sender Bank", "Source Bank", "From Bank"])
        bene_bank = extract_field(raw, ["Bank/FIs", "Beneficiary Bank", "Receiver Bank", "Target Bank", "To Bank"])
        bank_name = str(tx.bank_name or action_bank or bene_bank or "Unknown Bank").strip()

        holder = extract_field(raw, ["Account Holder Name", "Account Name", "Customer Name", "Beneficiary Name", "Favoring"])

        if primary_acc and primary_acc != "UNSPECIFIED":
            if primary_acc not in accounts_map:
                accounts_map[primary_acc] = {
                    "account": primary_acc,
                    "masked_account": mask_account_number(primary_acc),
                    "bank": bank_name,
                    "holder_name": str(holder).strip() if holder else "Not provided",
                    "layers": set(),
                    "total_transactions": 0,
                    "is_starting_account": False,
                }
            accounts_map[primary_acc]["layers"].add(layer_num)
            accounts_map[primary_acc]["total_transactions"] += 1
            if accounts_map[primary_acc]["bank"] == "Unknown Bank" and bank_name != "Unknown Bank":
                accounts_map[primary_acc]["bank"] = bank_name
            if holder and accounts_map[primary_acc]["holder_name"] == "Not provided":
                accounts_map[primary_acc]["holder_name"] = str(holder).strip()

            if "transfer" in sheet or "money transfer" in sheet:
                outgoing_counts[primary_acc] += 1

        # Check receiver account in Money Transfer
        if "transfer" in sheet or "money transfer" in sheet or tx.sheet_name == "Money Transfer to":
            dest_acc = normalize_account_identifier(
                extract_field(raw, ["Account No", "Beneficiary Account No", "Target Account", "Receiver Account No"])
            )
            if dest_acc and dest_acc != "UNSPECIFIED" and dest_acc != primary_acc:
                d_bank = str(bene_bank or tx.bank_name or "Unknown Bank").strip()
                if dest_acc not in accounts_map:
                    accounts_map[dest_acc] = {
                        "account": dest_acc,
                        "masked_account": mask_account_number(dest_acc),
                        "bank": d_bank,
                        "holder_name": str(holder).strip() if holder else "Not provided",
                        "layers": set(),
                        "total_transactions": 0,
                        "is_starting_account": False,
                    }
                accounts_map[dest_acc]["layers"].add(layer_num + 1)
                accounts_map[dest_acc]["total_transactions"] += 1
                incoming_counts[dest_acc] += 1
                if accounts_map[dest_acc]["bank"] == "Unknown Bank" and d_bank != "Unknown Bank":
                    accounts_map[dest_acc]["bank"] = d_bank

    # Determine starting accounts (Layer 1 or out > 0 and in == 0)
    for acc, data in accounts_map.items():
        is_l1 = (1 in data["layers"]) or (outgoing_counts[acc] > 0 and incoming_counts[acc] == 0)
        data["is_starting_account"] = is_l1
        data["layers"] = sorted(list(data["layers"]))

    sorted_accounts = sorted(
        accounts_map.values(),
        key=lambda x: (x["is_starting_account"], x["total_transactions"]),
        reverse=True,
    )

    return {
        "file_id": file_id,
        "case_id": case_id or 0,
        "filename": filename,
        "total_accounts": len(sorted_accounts),
        "accounts": sorted_accounts,
    }


def get_ncrp_account_activity_report_data(
    db: Session,
    file_id: int,
    account: Optional[str] = None,
    case_id: Optional[int] = None,
    layer_filter: Optional[str] = None,
    tx_type_filter: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    rapid_threshold_mins: int = 60,
) -> Dict[str, Any]:
    """
    Generate comprehensive Report 07 data for a selected suspicious account.
    """
    file_obj = db.query(NcrpFile).filter(NcrpFile.id == file_id).first()
    filename = file_obj.original_filename if file_obj else f"File #{file_id}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Retrieve all distinct accounts in workbook
    accounts_info = get_ncrp_workbook_accounts(db=db, file_id=file_id, case_id=case_id)
    available_accounts = accounts_info.get("accounts", [])

    if not available_accounts:
        return {
            "file_id": file_id,
            "case_id": case_id or 0,
            "filename": filename,
            "acknowledgement_no": None,
            "generated_at": now_iso,
            "report_title": "NCRP Account Activity & Exit Report",
            "selected_account": "",
            "selected_account_masked": "",
            "available_accounts": [],
            "filters_applied": {},
            "kpi_cards": {},
            "account_profile": {},
            "timeline_transactions": [],
            "incoming_vs_outgoing": {"daily_timeline": [], "summary_table": []},
            "rapid_fund_movement": {"records": [], "threshold_counts": {}},
            "exit_activity": {"destinations": [], "top_destinations": []},
            "last_traceable_activity": {},
            "amount_reconciliation": {},
            "suspicious_indicators": [],
            "data_quality_gaps": [],
            "suggested_actions": [],
            "graph_data": {"nodes": [], "edges": []},
        }

    # Select target account (use provided, or default to first starting/highest volume account)
    selected_acc = None
    if account and account.strip():
        norm_req = normalize_account_identifier(account)
        for a in available_accounts:
            if a["account"] == norm_req or a["account"] == account.strip():
                selected_acc = a["account"]
                break
    if not selected_acc:
        selected_acc = available_accounts[0]["account"]

    selected_meta = next((a for a in available_accounts if a["account"] == selected_acc), {
        "account": selected_acc,
        "masked_account": mask_account_number(selected_acc),
        "bank": "Unknown Bank",
        "holder_name": "Not provided",
        "layers": [1],
    })

    # Query all transactions
    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    # Track all transfers across workbook to check onward transfers for destination accounts
    all_workbook_senders: Set[str] = set()
    for tx in all_txs:
        raw = tx.raw_data or {}
        sheet = (tx.sheet_name or "").lower()
        if "transfer" in sheet or "money transfer" in sheet:
            s_acc = normalize_account_identifier(
                tx.account_or_wallet_id or extract_field(raw, [
                    "Account No./ (Wallet /PG/PA) Id", "From Account", "Sender Account No"
                ])
            )
            if s_acc:
                all_workbook_senders.add(s_acc)

    # Ingestion & Direction Classification for the selected account
    raw_records: List[Dict[str, Any]] = []
    seen_keys: Set[Tuple[str, int, str]] = set()

    for tx in all_txs:
        raw = tx.raw_data or {}
        sheet = (tx.sheet_name or "").lower()
        amt = float(tx.transaction_amount or parse_clean_amount(extract_field(raw, [
            "Transaction Amount", "Amount", "Withdrawal Amount", "Put on Hold Amount"
        ])) or 0.0)
        disp_amt = float(tx.disputed_amount or parse_clean_amount(extract_field(raw, [
            "Disputed Amount", "Disputed", "Put on Hold Amount"
        ])) or amt)

        dt_val = tx.transaction_date
        d_clean, dt_clean = parse_ncrp_datetime_string(dt_val or extract_field(raw, [
            "Transaction Date", "Transaction Date & Time", "Date & Time", "Date",
            "Withdrawal Date & Time", "Put on Hold Date", "Action Date"
        ]))
        parsed_dt = _parse_timestamp(dt_val)

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
        utr_val = tx.transaction_id_utr or extract_field(raw, ["Transaction ID / UTR Number", "transfer_utr", "UTR", "Reference No"])
        utr_str = str(utr_val).strip() if utr_val else None

        remarks = extract_field(raw, ["Remarks", "Action Remarks", "Transaction Description", "Description", "Narration"]) or ""
        holder = extract_field(raw, ["Account Holder Name", "Account Name", "Customer Name", "Beneficiary Name", "Favoring"]) or "Not provided"

        action_bank = extract_field(raw, ["Action Taken By bank", "action_taken_by_bank", "Sender Bank", "Source Bank", "From Bank"])
        bene_bank = extract_field(raw, ["Bank/FIs", "Beneficiary Bank", "Receiver Bank", "Target Bank", "To Bank"])
        s_bank = str(action_bank or tx.bank_name or "Unknown Bank").strip()
        d_bank = str(bene_bank or tx.bank_name or s_bank).strip()

        # Check if record is relevant to selected_acc
        is_money_transfer = ("transfer" in sheet or "money transfer" in sheet or tx.sheet_name == "Money Transfer to")
        is_atm = "atm" in sheet
        is_pos = "pos" in sheet
        is_cheque = ("cheque" in sheet or "check" in sheet)
        is_hold = "hold" in sheet
        is_other = ("other" in sheet or "debit" in sheet)

        if is_money_transfer:
            dest_acc = normalize_account_identifier(
                extract_field(raw, ["Account No", "Beneficiary Account No", "Target Account", "Receiver Account No"])
            )
            # Case 1: Incoming Credit to selected account
            if dest_acc == selected_acc and primary_acc != selected_acc:
                key = (tx.sheet_name, tx.row_number, "INCOMING")
                if key not in seen_keys:
                    seen_keys.add(key)
                    raw_records.append({
                        "id": tx.id,
                        "row_number": tx.row_number,
                        "sheet_name": tx.sheet_name,
                        "direction": "INCOMING",
                        "direction_label": "Incoming Credit",
                        "amount": amt,
                        "disputed_amount": disp_amt,
                        "date": d_clean,
                        "datetime": dt_clean,
                        "parsed_dt": parsed_dt,
                        "sender_account": primary_acc or "UNSPECIFIED",
                        "sender_account_masked": mask_account_number(primary_acc),
                        "sender_bank": s_bank,
                        "beneficiary_account": selected_acc,
                        "beneficiary_account_masked": mask_account_number(selected_acc),
                        "beneficiary_bank": d_bank if d_bank != "Unknown Bank" else selected_meta.get("bank", "Unknown Bank"),
                        "utr": utr_str,
                        "transaction_type": "TRANSFER",
                        "layer": layer_num,
                        "acknowledgement_no": ack,
                        "narration": remarks,
                        "holder_name": str(holder).strip(),
                        "link_status": "CONFIRMED" if _is_valid_utr(utr_str) else "POSSIBLE",
                    })

            # Case 2: Outgoing Transfer from selected account
            if primary_acc == selected_acc:
                key = (tx.sheet_name, tx.row_number, "OUTGOING")
                if key not in seen_keys:
                    seen_keys.add(key)
                    raw_records.append({
                        "id": tx.id,
                        "row_number": tx.row_number,
                        "sheet_name": tx.sheet_name,
                        "direction": "OUTGOING",
                        "direction_label": "Outgoing Transfer",
                        "amount": amt,
                        "disputed_amount": disp_amt,
                        "date": d_clean,
                        "datetime": dt_clean,
                        "parsed_dt": parsed_dt,
                        "sender_account": selected_acc,
                        "sender_account_masked": mask_account_number(selected_acc),
                        "sender_bank": s_bank if s_bank != "Unknown Bank" else selected_meta.get("bank", "Unknown Bank"),
                        "beneficiary_account": dest_acc or "UNSPECIFIED",
                        "beneficiary_account_masked": mask_account_number(dest_acc),
                        "beneficiary_bank": d_bank,
                        "utr": utr_str,
                        "transaction_type": "TRANSFER",
                        "layer": layer_num,
                        "acknowledgement_no": ack,
                        "narration": remarks,
                        "holder_name": str(holder).strip(),
                        "link_status": "CONFIRMED" if _is_valid_utr(utr_str) else "POSSIBLE",
                    })

        elif is_atm and (primary_acc == selected_acc or normalize_account_identifier(extract_field(raw, ["Account No"])) == selected_acc):
            key = (tx.sheet_name, tx.row_number, "WITHDRAWAL_ATM")
            if key not in seen_keys:
                seen_keys.add(key)
                atm_loc = extract_field(raw, ["ATM ID", "Location", "Terminal ID"]) or "ATM Dispenser"
                raw_records.append({
                    "id": tx.id,
                    "row_number": tx.row_number,
                    "sheet_name": tx.sheet_name,
                    "direction": "WITHDRAWAL",
                    "direction_label": "Cash Withdrawal",
                    "amount": amt,
                    "disputed_amount": disp_amt,
                    "date": d_clean,
                    "datetime": dt_clean,
                    "parsed_dt": parsed_dt,
                    "sender_account": selected_acc,
                    "sender_account_masked": mask_account_number(selected_acc),
                    "sender_bank": tx.bank_name or selected_meta.get("bank", "Unknown Bank"),
                    "beneficiary_account": "ATM_CASH_OUT",
                    "beneficiary_account_masked": "ATM Cash Withdrawal",
                    "beneficiary_bank": tx.bank_name or "ATM Cash Out",
                    "utr": utr_str or extract_field(raw, ["ATM ID", "Txn ID"]),
                    "transaction_type": "ATM",
                    "layer": layer_num,
                    "acknowledgement_no": ack,
                    "narration": f"ATM Cash Out: {atm_loc}",
                    "holder_name": "Self / Bearer",
                    "link_status": "CONFIRMED",
                })

        elif is_pos and (primary_acc == selected_acc or normalize_account_identifier(extract_field(raw, ["Account No"])) == selected_acc):
            key = (tx.sheet_name, tx.row_number, "WITHDRAWAL_POS")
            if key not in seen_keys:
                seen_keys.add(key)
                merchant = extract_field(raw, ["MID", "Merchant Name", "Terminal ID"]) or "POS Terminal"
                raw_records.append({
                    "id": tx.id,
                    "row_number": tx.row_number,
                    "sheet_name": tx.sheet_name,
                    "direction": "WITHDRAWAL",
                    "direction_label": "Cash Withdrawal",
                    "amount": amt,
                    "disputed_amount": disp_amt,
                    "date": d_clean,
                    "datetime": dt_clean,
                    "parsed_dt": parsed_dt,
                    "sender_account": selected_acc,
                    "sender_account_masked": mask_account_number(selected_acc),
                    "sender_bank": tx.bank_name or selected_meta.get("bank", "Unknown Bank"),
                    "beneficiary_account": "POS_MERCHANT",
                    "beneficiary_account_masked": f"Merchant ({merchant})",
                    "beneficiary_bank": "POS Settlement Merchant",
                    "utr": utr_str,
                    "transaction_type": "POS",
                    "layer": layer_num,
                    "acknowledgement_no": ack,
                    "narration": f"POS Swipe / Settlement: {merchant}",
                    "holder_name": str(merchant),
                    "link_status": "CONFIRMED",
                })

        elif is_cheque and (primary_acc == selected_acc or normalize_account_identifier(extract_field(raw, ["Account No"])) == selected_acc):
            key = (tx.sheet_name, tx.row_number, "WITHDRAWAL_CHEQUE")
            if key not in seen_keys:
                seen_keys.add(key)
                cheque_no = extract_field(raw, ["Cheque No", "Cheque Number", "Instrument No"]) or "Cheque"
                raw_records.append({
                    "id": tx.id,
                    "row_number": tx.row_number,
                    "sheet_name": tx.sheet_name,
                    "direction": "WITHDRAWAL",
                    "direction_label": "Cash Withdrawal",
                    "amount": amt,
                    "disputed_amount": disp_amt,
                    "date": d_clean,
                    "datetime": dt_clean,
                    "parsed_dt": parsed_dt,
                    "sender_account": selected_acc,
                    "sender_account_masked": mask_account_number(selected_acc),
                    "sender_bank": tx.bank_name or selected_meta.get("bank", "Unknown Bank"),
                    "beneficiary_account": "CHEQUE_CLEARING",
                    "beneficiary_account_masked": f"Cheque No. {cheque_no}",
                    "beneficiary_bank": "Clearing House",
                    "utr": utr_str or str(cheque_no),
                    "transaction_type": "CHEQUE",
                    "layer": layer_num,
                    "acknowledgement_no": ack,
                    "narration": f"Cheque Withdrawal #{cheque_no}",
                    "holder_name": "Bearer / Payee",
                    "link_status": "CONFIRMED",
                })

        elif is_hold and (primary_acc == selected_acc or normalize_account_identifier(extract_field(raw, ["Account No"])) == selected_acc):
            key = (tx.sheet_name, tx.row_number, "HOLD")
            if key not in seen_keys:
                seen_keys.add(key)
                raw_records.append({
                    "id": tx.id,
                    "row_number": tx.row_number,
                    "sheet_name": tx.sheet_name,
                    "direction": "HOLD",
                    "direction_label": "Hold / Lien Event",
                    "amount": amt,
                    "disputed_amount": disp_amt,
                    "date": d_clean,
                    "datetime": dt_clean,
                    "parsed_dt": parsed_dt,
                    "sender_account": selected_acc,
                    "sender_account_masked": mask_account_number(selected_acc),
                    "sender_bank": tx.bank_name or selected_meta.get("bank", "Unknown Bank"),
                    "beneficiary_account": "BANK_HOLD_LIEN",
                    "beneficiary_account_masked": "Statutory Hold / Lien",
                    "beneficiary_bank": tx.bank_name or selected_meta.get("bank", "Unknown Bank"),
                    "utr": utr_str,
                    "transaction_type": "HOLD",
                    "layer": layer_num,
                    "acknowledgement_no": ack,
                    "narration": "Account balance held / lien marked by bank",
                    "holder_name": selected_meta.get("holder_name", "Not provided"),
                    "link_status": "CONFIRMED",
                })

        elif is_other and (primary_acc == selected_acc or normalize_account_identifier(extract_field(raw, ["Account No"])) == selected_acc):
            key = (tx.sheet_name, tx.row_number, "OTHER_DEBIT")
            if key not in seen_keys:
                seen_keys.add(key)
                raw_records.append({
                    "id": tx.id,
                    "row_number": tx.row_number,
                    "sheet_name": tx.sheet_name,
                    "direction": "OTHER_DEBIT",
                    "direction_label": "Other Debit",
                    "amount": amt,
                    "disputed_amount": disp_amt,
                    "date": d_clean,
                    "datetime": dt_clean,
                    "parsed_dt": parsed_dt,
                    "sender_account": selected_acc,
                    "sender_account_masked": mask_account_number(selected_acc),
                    "sender_bank": tx.bank_name or selected_meta.get("bank", "Unknown Bank"),
                    "beneficiary_account": "OTHER_DEBIT_ENDPOINT",
                    "beneficiary_account_masked": "Unspecified Destination",
                    "beneficiary_bank": tx.bank_name or "Unknown Bank",
                    "utr": utr_str,
                    "transaction_type": "DEBIT",
                    "layer": layer_num,
                    "acknowledgement_no": ack,
                    "narration": remarks or "Other debit entry",
                    "holder_name": "Not provided",
                    "link_status": "POSSIBLE",
                })

    # Sort all raw records chronologically
    raw_records.sort(key=lambda r: (
        r["parsed_dt"].isoformat() if r["parsed_dt"] else (r["date"] or "1970-01-01"),
        r["id"],
    ))

    # Identify major incoming credits (amount >= 50,000 or top incoming credit)
    incoming_credits = [r for r in raw_records if r["direction"] == "INCOMING"]
    max_incoming = max([r["amount"] for r in incoming_credits], default=0.0)
    major_threshold = max(50000.0, max_incoming * 0.5)

    major_credit_dates = [
        r["parsed_dt"] or (datetime.datetime.strptime(r["date"], "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc) if r["date"] else None)
        for r in incoming_credits if r["amount"] >= major_threshold
    ]
    first_major_dt = min([dt for dt in major_credit_dates if dt is not None], default=None)

    for r in raw_records:
        r_dt = r["parsed_dt"] or (datetime.datetime.strptime(r["date"], "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc) if r["date"] else None)
        if first_major_dt and r_dt and r_dt >= first_major_dt:
            r["is_after_major_credit"] = True
        else:
            r["is_after_major_credit"] = False

    # Apply optional user filters
    filtered_records = list(raw_records)
    if layer_filter and layer_filter.strip().upper() not in {"ALL", ""}:
        try:
            target_layer = int("".join(c for c in layer_filter if c.isdigit()))
            filtered_records = [r for r in filtered_records if r["layer"] == target_layer]
        except Exception:
            pass

    if tx_type_filter and tx_type_filter.strip().upper() not in {"ALL", ""}:
        clean_type = tx_type_filter.strip().upper()
        filtered_records = [r for r in filtered_records if r["direction"] == clean_type]

    if date_from and date_from.strip():
        filtered_records = [r for r in filtered_records if (r["date"] or "") >= date_from.strip()]

    if date_to and date_to.strip():
        filtered_records = [r for r in filtered_records if (r["date"] or "") <= date_to.strip()]

    # ------------------------------------------------------------
    # 1. DYNAMIC KPI CARDS CALCULATION
    # ------------------------------------------------------------
    total_tx_count = len(filtered_records)
    total_incoming = round(sum(r["amount"] for r in filtered_records if r["direction"] == "INCOMING"), 2)
    transfer_outflow = round(sum(r["amount"] for r in filtered_records if r["direction"] == "OUTGOING"), 2)
    cash_withdrawal = round(sum(r["amount"] for r in filtered_records if r["direction"] == "WITHDRAWAL"), 2)
    other_debit = round(sum(r["amount"] for r in filtered_records if r["direction"] == "OTHER_DEBIT"), 2)
    total_outgoing = round(transfer_outflow + cash_withdrawal + other_debit, 2)
    verified_held_amount = round(sum(r["amount"] for r in filtered_records if r["direction"] == "HOLD"), 2)

    # Formula: max(0, Total Incoming − Recorded Outgoing Transfers − Recorded Withdrawals − Verified Held Amount)
    estimated_unresolved = 0.0
    if total_incoming > 0:
        estimated_unresolved = max(0.0, round(total_incoming - transfer_outflow - cash_withdrawal - verified_held_amount, 2))

    # Last recorded activity
    last_tx = filtered_records[-1] if filtered_records else None
    last_recorded_activity = {
        "date": last_tx["date"] if last_tx else None,
        "datetime": last_tx["datetime"] if last_tx else None,
        "direction": last_tx["direction_label"] if last_tx else "No Activity",
        "amount": last_tx["amount"] if last_tx else 0.0,
        "utr": last_tx["utr"] if last_tx else None,
    }

    # Linked destination accounts count
    unique_destinations = set(
        r["beneficiary_account"] for r in filtered_records
        if r["direction"] == "OUTGOING" and r["beneficiary_account"] and r["beneficiary_account"] != "UNSPECIFIED"
    )
    linked_destinations_count = len(unique_destinations)

    kpi_cards = {
        "total_transactions": total_tx_count,
        "total_incoming": total_incoming,
        "total_outgoing": total_outgoing,
        "transfer_outflow": transfer_outflow,
        "cash_withdrawal": cash_withdrawal,
        "verified_held_amount": verified_held_amount,
        "estimated_unresolved_amount": estimated_unresolved,
        "last_recorded_activity": last_recorded_activity,
        "linked_destination_accounts": linked_destinations_count,
    }

    # ------------------------------------------------------------
    # 2. ACCOUNT PROFILE SUMMARY
    # ------------------------------------------------------------
    dates_with_values = [r["date"] for r in filtered_records if r["date"]]
    first_date = min(dates_with_values) if dates_with_values else None
    last_date = max(dates_with_values) if dates_with_values else None

    incoming_count = sum(1 for r in filtered_records if r["direction"] == "INCOMING")
    outgoing_count = sum(1 for r in filtered_records if r["direction"] in {"OUTGOING", "WITHDRAWAL", "OTHER_DEBIT"})
    unverified_count = sum(1 for r in filtered_records if not _is_valid_utr(r.get("utr")))

    account_profile = {
        "account": selected_acc,
        "masked_account": mask_account_number(selected_acc),
        "bank": selected_meta.get("bank", "Unknown Bank"),
        "holder_name": selected_meta.get("holder_name", "Not provided"),
        "layers": selected_meta.get("layers", [1]),
        "total_incoming": total_incoming,
        "total_outgoing": total_outgoing,
        "transfer_outflow": transfer_outflow,
        "cash_withdrawal": cash_withdrawal,
        "verified_held_amount": verified_held_amount,
        "estimated_unresolved_amount": estimated_unresolved,
        "first_recorded_date": first_date or "Not available",
        "last_recorded_date": last_date or "Not available",
        "incoming_count": incoming_count,
        "outgoing_count": outgoing_count,
        "linked_destinations_count": linked_destinations_count,
        "records_requiring_verification": unverified_count,
    }

    # ------------------------------------------------------------
    # 3. INCOMING VS OUTGOING ANALYSIS (CHART & SUMMARY TABLE)
    # ------------------------------------------------------------
    daily_groups = defaultdict(lambda: {
        "date": "",
        "incoming_amount": 0.0,
        "outgoing_transfer_amount": 0.0,
        "withdrawal_amount": 0.0,
        "other_debit_amount": 0.0,
        "incoming_count": 0,
        "outgoing_count": 0,
    })

    for r in filtered_records:
        d = r["date"] or "Unknown Date"
        daily_groups[d]["date"] = d
        if r["direction"] == "INCOMING":
            daily_groups[d]["incoming_amount"] += r["amount"]
            daily_groups[d]["incoming_count"] += 1
        elif r["direction"] == "OUTGOING":
            daily_groups[d]["outgoing_transfer_amount"] += r["amount"]
            daily_groups[d]["outgoing_count"] += 1
        elif r["direction"] == "WITHDRAWAL":
            daily_groups[d]["withdrawal_amount"] += r["amount"]
            daily_groups[d]["outgoing_count"] += 1
        elif r["direction"] == "OTHER_DEBIT":
            daily_groups[d]["other_debit_amount"] += r["amount"]
            daily_groups[d]["outgoing_count"] += 1

    daily_timeline = sorted(daily_groups.values(), key=lambda x: x["date"])
    for d in daily_timeline:
        d["incoming_amount"] = round(d["incoming_amount"], 2)
        d["outgoing_transfer_amount"] = round(d["outgoing_transfer_amount"], 2)
        d["withdrawal_amount"] = round(d["withdrawal_amount"], 2)
        d["other_debit_amount"] = round(d["other_debit_amount"], 2)

    summary_table = [
        {"metric": "Incoming Transaction Count", "value": incoming_count, "unit": "count"},
        {"metric": "Incoming Amount", "value": total_incoming, "unit": "currency"},
        {"metric": "Outgoing Transfer Count", "value": sum(1 for r in filtered_records if r["direction"] == "OUTGOING"), "unit": "count"},
        {"metric": "Outgoing Transfer Amount", "value": transfer_outflow, "unit": "currency"},
        {"metric": "Withdrawal Count", "value": sum(1 for r in filtered_records if r["direction"] == "WITHDRAWAL"), "unit": "count"},
        {"metric": "Withdrawal Amount", "value": cash_withdrawal, "unit": "currency"},
        {"metric": "Other Debit Count", "value": sum(1 for r in filtered_records if r["direction"] == "OTHER_DEBIT"), "unit": "count"},
        {"metric": "Other Debit Amount", "value": other_debit, "unit": "currency"},
    ]

    # ------------------------------------------------------------
    # 4. RAPID FUND MOVEMENT ANALYSIS
    # ------------------------------------------------------------
    rapid_movement_records: List[Dict[str, Any]] = []
    incoming_txs = [r for r in filtered_records if r["direction"] == "INCOMING"]
    outgoing_txs = [r for r in filtered_records if r["direction"] in {"OUTGOING", "WITHDRAWAL"}]

    threshold_counts = {
        "within_15_mins": 0,
        "within_1_hour": 0,
        "within_24_hours": 0,
        "over_24_hours": 0,
    }

    for inc in incoming_txs:
        inc_dt = inc["parsed_dt"]
        for out in outgoing_txs:
            out_dt = out["parsed_dt"]
            time_diff_mins = None
            threshold_label = "Uncertain Timestamp"

            if inc_dt and out_dt:
                delta_sec = (out_dt - inc_dt).total_seconds()
                if delta_sec >= 0:
                    time_diff_mins = round(delta_sec / 60.0, 1)
                    if time_diff_mins <= 15:
                        threshold_label = "Within 15 minutes"
                        threshold_counts["within_15_mins"] += 1
                    elif time_diff_mins <= 60:
                        threshold_label = "Within 1 hour"
                        threshold_counts["within_1_hour"] += 1
                    elif time_diff_mins <= 1440:
                        threshold_label = "Within 24 hours"
                        threshold_counts["within_24_hours"] += 1
                    else:
                        threshold_label = "Over 24 hours"
                        threshold_counts["over_24_hours"] += 1
                else:
                    continue
            elif inc["date"] and out["date"] and inc["date"] <= out["date"]:
                threshold_label = "Same / Subsequent Day"

            if time_diff_mins is not None or (inc["date"] and out["date"] and inc["date"] <= out["date"]):
                if time_diff_mins is not None:
                    if time_diff_mins < 60:
                        time_str = f"{int(time_diff_mins)} mins"
                    elif time_diff_mins < 1440:
                        h = int(time_diff_mins // 60)
                        m = int(time_diff_mins % 60)
                        time_str = f"{h}h {m}m"
                    else:
                        d = int(time_diff_mins // 1440)
                        h = int((time_diff_mins % 1440) // 60)
                        time_str = f"{d}d {h}h"
                else:
                    time_str = f"{inc['date']} to {out['date']}"

                amt_ratio = round((out["amount"] / inc["amount"] * 100), 1) if inc["amount"] > 0 else 0.0

                rapid_movement_records.append({
                    "association_id": f"RPM-{len(rapid_movement_records)+1:03d}",
                    "incoming_id": inc["id"],
                    "incoming_date": inc["datetime"] or inc["date"],
                    "incoming_amount": inc["amount"],
                    "incoming_sender": inc["sender_account_masked"],
                    "incoming_sender_bank": inc["sender_bank"],
                    "incoming_utr": inc["utr"] or "Unrecorded",
                    "outgoing_id": out["id"],
                    "outgoing_date": out["datetime"] or out["date"],
                    "outgoing_amount": out["amount"],
                    "outgoing_dest": out["beneficiary_account_masked"],
                    "outgoing_dest_bank": out["beneficiary_bank"],
                    "outgoing_utr": out["utr"] or "Unrecorded",
                    "outgoing_type": out["direction_label"],
                    "time_gap_minutes": time_diff_mins,
                    "time_gap_formatted": time_str,
                    "threshold_label": threshold_label,
                    "amount_ratio_pct": amt_ratio,
                    "link_status": "Possible Temporal Association",
                    "methodology_note": "Temporal proximity between credit and debit; exact allocation requires core banking sequence numbers.",
                })

    rapid_movement_records.sort(key=lambda x: (
        x["time_gap_minutes"] if x["time_gap_minutes"] is not None else 999999
    ))

    # ------------------------------------------------------------
    # 5. EXIT ACTIVITY AND DESTINATION ACCOUNTS
    # ------------------------------------------------------------
    destination_map: Dict[str, Dict[str, Any]] = {}
    detailed_exits: List[Dict[str, Any]] = []

    for r in filtered_records:
        if r["direction"] == "OUTGOING":
            dest = r["beneficiary_account"]
            if not dest:
                continue
            has_onward = dest in all_workbook_senders

            detailed_exits.append({
                "beneficiary_account": dest,
                "beneficiary_account_masked": mask_account_number(dest),
                "beneficiary_bank": r["beneficiary_bank"],
                "transfer_amount": r["amount"],
                "transaction_date": r["datetime"] or r["date"],
                "utr": r["utr"] or "Unrecorded",
                "transaction_type": r["transaction_type"],
                "layer": r["layer"],
                "link_status": r["link_status"],
                "has_onward_transfers": has_onward,
                "onward_status_label": "Onward Transfers Logged" if has_onward else "Terminal in Workbook",
            })

            if dest not in destination_map:
                destination_map[dest] = {
                    "beneficiary_account": dest,
                    "beneficiary_account_masked": mask_account_number(dest),
                    "beneficiary_bank": r["beneficiary_bank"],
                    "total_amount": 0.0,
                    "transfer_count": 0,
                    "last_transfer_date": r["date"],
                    "has_onward_transfers": has_onward,
                    "status_description": "Onward transfers recorded in workbook" if has_onward else "Terminal destination in workbook (evidence required)",
                }
            destination_map[dest]["total_amount"] += r["amount"]
            destination_map[dest]["transfer_count"] += 1
            if r["date"] and (not destination_map[dest]["last_transfer_date"] or r["date"] > destination_map[dest]["last_transfer_date"]):
                destination_map[dest]["last_transfer_date"] = r["date"]

    top_destinations = sorted(
        destination_map.values(),
        key=lambda x: x["total_amount"],
        reverse=True,
    )
    for td in top_destinations:
        td["total_amount"] = round(td["total_amount"], 2)

    # ------------------------------------------------------------
    # 6. LAST TRACEABLE ACTIVITY SUMMARY
    # ------------------------------------------------------------
    last_outgoing_tx = next((r for r in reversed(filtered_records) if r["direction"] == "OUTGOING"), None)
    last_withdrawal_tx = next((r for r in reversed(filtered_records) if r["direction"] == "WITHDRAWAL"), None)
    last_hold_tx = next((r for r in reversed(filtered_records) if r["direction"] == "HOLD"), None)

    reason_trace_ends = "Active account activity recorded within workbook."
    last_trace_type = "Transfer Outflow"
    if last_tx:
        if last_tx["direction"] == "WITHDRAWAL":
            reason_trace_ends = f"Funds dispersed via cash withdrawal ({last_tx.get('transaction_type', 'Cash')}) of ₹{last_tx['amount']:,.2f}. Trail exits formal electronic banking channel."
            last_trace_type = "Cash Dispersal"
        elif last_tx["direction"] == "HOLD":
            reason_trace_ends = f"Statutory hold/lien of ₹{last_tx['amount']:,.2f} recorded on account. Funds retained under bank lien."
            last_trace_type = "Statutory Hold"
        elif last_outgoing_tx:
            dest_acc_val = last_outgoing_tx["beneficiary_account"]
            if dest_acc_val not in all_workbook_senders:
                reason_trace_ends = f"Funds transferred to {last_outgoing_tx['beneficiary_bank']} account {last_outgoing_tx['beneficiary_account_masked']}. No further onward transfers recorded in this NCRP workbook."
                last_trace_type = "Terminal Destination"
            else:
                reason_trace_ends = f"Transfer to {last_outgoing_tx['beneficiary_bank']} with onward transfer records logged in workbook."
                last_trace_type = "Onward Multi-Layer Flow"
        elif total_incoming > 0 and total_outgoing == 0:
            reason_trace_ends = f"Account received ₹{total_incoming:,.2f} with no recorded debit, withdrawal, or hold entries in this workbook. Core banking statement requisition required u/s 91 CrPC."
            last_trace_type = "Terminal Inflow Gap"

    last_traceable_activity = {
        "last_transaction": {
            "date": last_tx["datetime"] or last_tx["date"] if last_tx else "Not available",
            "direction": last_tx["direction_label"] if last_tx else "None",
            "amount": last_tx["amount"] if last_tx else 0.0,
            "utr": last_tx["utr"] if last_tx else "Not available",
            "counterparty": last_tx["beneficiary_account_masked"] if last_tx and last_tx["direction"] != "INCOMING" else (last_tx["sender_account_masked"] if last_tx else "N/A"),
        } if last_tx else None,
        "last_outgoing_transfer": {
            "date": last_outgoing_tx["datetime"] or last_outgoing_tx["date"],
            "destination_account": last_outgoing_tx["beneficiary_account_masked"],
            "destination_bank": last_outgoing_tx["beneficiary_bank"],
            "amount": last_outgoing_tx["amount"],
            "utr": last_outgoing_tx["utr"] or "Unrecorded",
            "has_onward_transfers": last_outgoing_tx["beneficiary_account"] in all_workbook_senders,
        } if last_outgoing_tx else None,
        "last_cash_withdrawal": {
            "date": last_withdrawal_tx["datetime"] or last_withdrawal_tx["date"],
            "channel": last_withdrawal_tx["transaction_type"],
            "amount": last_withdrawal_tx["amount"],
            "terminal_or_narration": last_withdrawal_tx["narration"],
        } if last_withdrawal_tx else None,
        "last_hold_event": {
            "date": last_hold_tx["datetime"] or last_hold_tx["date"],
            "amount": last_hold_tx["amount"],
            "bank": last_hold_tx["beneficiary_bank"],
        } if last_hold_tx else None,
        "last_known_destination": top_destinations[0] if top_destinations else None,
        "last_traceable_layer": max(selected_meta.get("layers", [1])),
        "reason_trace_ends": reason_trace_ends,
        "last_trace_type": last_trace_type,
    }

    # ------------------------------------------------------------
    # 7. AMOUNT RECONCILIATION
    # ------------------------------------------------------------
    amount_reconciliation = {
        "total_incoming_credits": total_incoming,
        "recorded_outgoing_transfers": transfer_outflow,
        "recorded_cash_withdrawals": cash_withdrawal,
        "recorded_other_debits": other_debit,
        "verified_held_amount": verified_held_amount,
        "estimated_unresolved_amount": estimated_unresolved,
        "formula": "max(0, Total Incoming − Recorded Outgoing Transfers − Recorded Withdrawals − Verified Held Amount)",
        "reconciliation_status": "BALANCED_EXITS" if estimated_unresolved == 0 and total_incoming > 0 else (
            "UNRESOLVED_FUNDS_REMAIN" if estimated_unresolved > 0 else "NO_INFLOW"
        ),
        "notes": [
            "Estimated unresolved amount represents funds whose onward dispersal is unrecorded in this NCRP workbook.",
            "This figure is an analytical estimate based solely on NCRP workbook entries, NOT a verified live core-banking balance.",
            "Hold/lien amounts are accounted for separately to prevent double counting against debits.",
        ],
    }

    # ------------------------------------------------------------
    # 8. SUSPICIOUS ACTIVITY INDICATORS
    # ------------------------------------------------------------
    suspicious_indicators: List[Dict[str, Any]] = []

    rapid_1h = [r for r in rapid_movement_records if r.get("time_gap_minutes") is not None and r["time_gap_minutes"] <= 60]
    if rapid_1h:
        suspicious_indicators.append({
            "indicator_id": "IND-001",
            "title": "Rapid Outgoing Fund Dispersal",
            "severity": "HIGH",
            "description": f"{len(rapid_1h)} outgoing transaction(s) occurred within 60 minutes of incoming credits.",
            "evidence": f"Transfers/withdrawals initiated as early as {rapid_1h[0]['time_gap_formatted']} post-credit.",
            "affected_count": len(rapid_1h),
        })

    if total_incoming > 0 and (total_outgoing / total_incoming) >= 0.95:
        suspicious_indicators.append({
            "indicator_id": "IND-002",
            "title": "Near-Complete Account Depletion",
            "severity": "HIGH",
            "description": f"Account exhibits a {(total_outgoing / total_incoming * 100):.1f}% exit ratio, characteristic of pass-through / mule behavior.",
            "evidence": f"₹{total_outgoing:,.2f} exited against ₹{total_incoming:,.2f} incoming.",
            "affected_count": outgoing_count,
        })

    if linked_destinations_count >= 3:
        suspicious_indicators.append({
            "indicator_id": "IND-003",
            "title": "Multi-Beneficiary Fan-Out Pattern",
            "severity": "MEDIUM",
            "description": f"Funds dispersed across {linked_destinations_count} distinct destination accounts, diffusing the money trail.",
            "evidence": f"Outgoing transfers sent to {linked_destinations_count} unique receiver accounts.",
            "affected_count": linked_destinations_count,
        })

    if cash_withdrawal > 0:
        suspicious_indicators.append({
            "indicator_id": "IND-004",
            "title": "Cash-Out Dispersal via ATM / POS / Cheque",
            "severity": "HIGH",
            "description": f"Confirmed cash withdrawals totaling ₹{cash_withdrawal:,.2f} removed funds from the traceable banking trail.",
            "evidence": f"Recorded cash-out entries under ATM, POS, or Cheque worksheets.",
            "affected_count": sum(1 for r in filtered_records if r["direction"] == "WITHDRAWAL"),
        })

    if top_destinations and transfer_outflow > 0:
        top_dest = top_destinations[0]
        if (top_dest["total_amount"] / transfer_outflow) >= 0.6:
            suspicious_indicators.append({
                "indicator_id": "IND-005",
                "title": "Concentrated Transfer to Single Destination",
                "severity": "MEDIUM",
                "description": f"Over 60% of transfer outflow (₹{top_dest['total_amount']:,.2f}) was routed to a single beneficiary account.",
                "evidence": f"Recipient: {top_dest['beneficiary_bank']} ({top_dest['beneficiary_account_masked']}).",
                "affected_count": top_dest["transfer_count"],
            })

    missing_utr_txs = [r for r in filtered_records if not _is_valid_utr(r.get("utr"))]
    if missing_utr_txs:
        suspicious_indicators.append({
            "indicator_id": "IND-006",
            "title": "Missing Transaction UTR / Reference Numbers",
            "severity": "LOW",
            "description": f"{len(missing_utr_txs)} transaction record(s) lack confirmed clearing UTR numbers in workbook.",
            "evidence": f"Records listed without valid IMPS/NEFT clearing reference.",
            "affected_count": len(missing_utr_txs),
        })

    # ------------------------------------------------------------
    # 9. DATA QUALITY AND INVESTIGATION GAPS
    # ------------------------------------------------------------
    data_quality_gaps: List[Dict[str, Any]] = []
    gap_counter = 1

    for r in filtered_records:
        if not _is_valid_utr(r.get("utr")):
            data_quality_gaps.append({
                "gap_id": f"GAP-{gap_counter:03d}",
                "category": "Missing Clearing UTR",
                "affected_record": f"Row #{r['row_number']} ({r['direction_label']})",
                "source_sheet": r["sheet_name"],
                "source_row": r["row_number"],
                "details": f"Amount ₹{r['amount']:,.2f} recorded on {r['date'] or 'unspecified date'} without verified UTR.",
                "evidence_required": "Summon remitting bank to provide core banking transaction log and inter-bank clearing UTR.",
            })
            gap_counter += 1

        if r.get("beneficiary_bank") in {"Unknown Bank", "", None} and r["direction"] == "OUTGOING":
            data_quality_gaps.append({
                "gap_id": f"GAP-{gap_counter:03d}",
                "category": "Missing Counterparty Bank Name",
                "affected_record": f"Destination: {r['beneficiary_account_masked']}",
                "source_sheet": r["sheet_name"],
                "source_row": r["row_number"],
                "details": "Beneficiary institution name was not identified in the worksheet.",
                "evidence_required": "Request remitter bank to furnish beneficiary IFSC code and destination clearing bank details.",
            })
            gap_counter += 1

    if estimated_unresolved > 0:
        data_quality_gaps.append({
            "gap_id": f"GAP-{gap_counter:03d}",
            "category": "Incomplete Downstream Statement Trail",
            "affected_record": f"Account {selected_meta['masked_account']}",
            "source_sheet": "Workbook Level",
            "source_row": 0,
            "details": f"₹{estimated_unresolved:,.2f} incoming funds lack subsequent debit or hold entries in the workbook.",
            "evidence_required": "Issue Section 91 CrPC notice to bank for complete account statement covering next 30 days.",
        })
        gap_counter += 1

    cash_records = [r for r in filtered_records if r["direction"] == "WITHDRAWAL"]
    if cash_records:
        data_quality_gaps.append({
            "gap_id": f"GAP-{gap_counter:03d}",
            "category": "Unverified Cash-Out Evidence",
            "affected_record": f"Account {selected_meta['masked_account']}",
            "source_sheet": "ATM / POS / Cheque",
            "source_row": 0,
            "details": f"Total ₹{cash_withdrawal:,.2f} withdrawn across {len(cash_records)} transaction(s) without physical slip/CCTV corroboration.",
            "evidence_required": "Obtain ATM CCTV footage, POS terminal merchant settlement receipts, or cheque counterfoils.",
        })
        gap_counter += 1

    # ------------------------------------------------------------
    # 10. SUGGESTED INVESTIGATIVE ACTIONS
    # ------------------------------------------------------------
    suggested_actions: List[Dict[str, Any]] = []
    action_counter = 1

    if estimated_unresolved > 0:
        suggested_actions.append({
            "action_id": f"ACT-{action_counter:03d}",
            "priority": "HIGH",
            "finding": f"Unresolved fund balance of ₹{estimated_unresolved:,.2f} remains unaccounted for in workbook.",
            "recommended_action": f"Requisition complete core banking statement of {selected_meta['masked_account']} from {selected_meta['bank']} under Section 91 CrPC.",
            "target_entity": selected_meta["bank"],
            "legal_provision": "Section 91 CrPC / Section 94 BNSS",
        })
        action_counter += 1

    if top_destinations:
        for td in top_destinations[:2]:
            suggested_actions.append({
                "action_id": f"ACT-{action_counter:03d}",
                "priority": "HIGH",
                "finding": f"Significant outflow of ₹{td['total_amount']:,.2f} transferred to {td['beneficiary_bank']} account {td['beneficiary_account_masked']}.",
                "recommended_action": f"Freeze beneficiary account {td['beneficiary_account_masked']} under Section 102 CrPC and requisition KYC and statement.",
                "target_entity": td["beneficiary_bank"],
                "legal_provision": "Section 102 CrPC / Section 107 BNSS",
            })
            action_counter += 1

    if cash_withdrawal > 0:
        suggested_actions.append({
            "action_id": f"ACT-{action_counter:03d}",
            "priority": "HIGH",
            "finding": f"₹{cash_withdrawal:,.2f} cashed out via ATM/POS/Cheque.",
            "recommended_action": "Serve notice to acquiring bank to preserve and provide ATM CCTV recordings and POS merchant KYC.",
            "target_entity": "Acquiring Bank / Switch",
            "legal_provision": "Section 91 CrPC / NPCI Circulars",
        })
        action_counter += 1

    if missing_utr_txs:
        suggested_actions.append({
            "action_id": f"ACT-{action_counter:03d}",
            "priority": "MEDIUM",
            "finding": f"{len(missing_utr_txs)} transfer(s) lack clearing UTR reference.",
            "recommended_action": f"Request {selected_meta['bank']} to furnish NPCI/RBI clearing logs and confirm inter-bank credit status.",
            "target_entity": selected_meta["bank"],
            "legal_provision": "Banking Regulation Act / Section 91 CrPC",
        })
        action_counter += 1

    if verified_held_amount > 0:
        suggested_actions.append({
            "action_id": f"ACT-{action_counter:03d}",
            "priority": "MEDIUM",
            "finding": f"Verified hold amount of ₹{verified_held_amount:,.2f} reported under lien.",
            "recommended_action": f"Verify lien currency and debit freeze status with {selected_meta['bank']} Nodal Officer for recovery proceedings.",
            "target_entity": selected_meta["bank"],
            "legal_provision": "Section 102 CrPC / Section 457 CrPC",
        })
        action_counter += 1

    # ------------------------------------------------------------
    # 11. INTERACTIVE GRAPH DATA (RELATIONSHIP VISUALIZATION)
    # ------------------------------------------------------------
    graph_nodes = []
    graph_edges = []
    seen_nodes = set()

    subject_layer = 2
    graph_nodes.append({
        "id": selected_acc,
        "account": selected_acc,
        "masked_account": mask_account_number(selected_acc),
        "bank": selected_meta.get("bank", "Unknown Bank"),
        "holder_name": selected_meta.get("holder_name", "Subject Account"),
        "layer": subject_layer,
        "role": "Subject Account",
        "is_terminal": False,
        "total_incoming": total_incoming,
        "total_outgoing": total_outgoing,
        "held_amount": verified_held_amount,
        "withdrawn_amount": cash_withdrawal,
        "unresolved_amount": estimated_unresolved,
        "tx_count": total_tx_count,
        "last_transaction_date": last_date or "Not available",
    })
    seen_nodes.add(selected_acc)

    # Inbound sources (Layer 1)
    for r in filtered_records:
        if r["direction"] == "INCOMING":
            s_acc = r["sender_account"] or "UNSPECIFIED_SENDER"
            if s_acc not in seen_nodes:
                seen_nodes.add(s_acc)
                graph_nodes.append({
                    "id": s_acc,
                    "account": s_acc,
                    "masked_account": mask_account_number(s_acc),
                    "bank": r["sender_bank"] or "Unknown Bank",
                    "holder_name": "Source Remitter",
                    "layer": 1,
                    "role": "Starting Account",
                    "is_terminal": False,
                    "total_incoming": 0.0,
                    "total_outgoing": r["amount"],
                    "held_amount": 0.0,
                    "withdrawn_amount": 0.0,
                    "unresolved_amount": 0.0,
                    "tx_count": 1,
                    "last_transaction_date": r["date"] or "Not available",
                })
            edge_id = f"edge_in_{r['id']}_{r['row_number']}"
            graph_edges.append({
                "id": edge_id,
                "source": s_acc,
                "target": selected_acc,
                "amount": r["amount"],
                "disputed_amount": r.get("disputed_amount", r["amount"]),
                "utr": r["utr"] or "Not available",
                "date": r["date"] or "Not available",
                "datetime": r["datetime"] or r["date"] or "Not available",
                "source_bank": r["sender_bank"],
                "dest_bank": r["beneficiary_bank"],
                "layer_from": 1,
                "layer_to": subject_layer,
                "status": r["link_status"],
                "is_cycle": False,
                "evidence": [f"Worksheet: {r['sheet_name']}, Row #{r['row_number']}", f"UTR: {r['utr'] or 'Pending'}"],
                "rationale": "Incoming credit transferred into subject account.",
                "missing_fields": [],
                "remarks": r["narration"] or "Inbound transfer",
                "source_sheet": r["sheet_name"],
                "source_row": r["row_number"],
                "tx_id": r["id"],
            })

    # Outbound destinations (Layer 3)
    for r in filtered_records:
        if r["direction"] == "OUTGOING":
            d_acc = r["beneficiary_account"] or "UNSPECIFIED_DEST"
            has_onward = d_acc in all_workbook_senders
            if d_acc not in seen_nodes:
                seen_nodes.add(d_acc)
                graph_nodes.append({
                    "id": d_acc,
                    "account": d_acc,
                    "masked_account": mask_account_number(d_acc),
                    "bank": r["beneficiary_bank"] or "Unknown Bank",
                    "holder_name": r.get("holder_name") or "Beneficiary",
                    "layer": 3,
                    "role": "Intermediary Account" if has_onward else "Terminal Account",
                    "is_terminal": not has_onward,
                    "terminal_status": "Terminal in Workbook" if not has_onward else None,
                    "total_incoming": r["amount"],
                    "total_outgoing": 0.0,
                    "held_amount": 0.0,
                    "withdrawn_amount": 0.0,
                    "unresolved_amount": 0.0,
                    "tx_count": 1,
                    "last_transaction_date": r["date"] or "Not available",
                })
            edge_id = f"edge_out_{r['id']}_{r['row_number']}"
            graph_edges.append({
                "id": edge_id,
                "source": selected_acc,
                "target": d_acc,
                "amount": r["amount"],
                "disputed_amount": r.get("disputed_amount", r["amount"]),
                "utr": r["utr"] or "Not available",
                "date": r["date"] or "Not available",
                "datetime": r["datetime"] or r["date"] or "Not available",
                "source_bank": r["sender_bank"],
                "dest_bank": r["beneficiary_bank"],
                "layer_from": subject_layer,
                "layer_to": 3,
                "status": r["link_status"],
                "is_cycle": False,
                "evidence": [f"Worksheet: {r['sheet_name']}, Row #{r['row_number']}", f"UTR: {r['utr'] or 'Pending'}"],
                "rationale": "Outgoing fund transfer to destination account.",
                "missing_fields": [],
                "remarks": r["narration"] or "Outbound transfer",
                "source_sheet": r["sheet_name"],
                "source_row": r["row_number"],
                "tx_id": r["id"],
            })

    # Cash withdrawal endpoint
    if cash_withdrawal > 0:
        cash_node_id = "CASH_DISPERSAL_ENDPOINT"
        if cash_node_id not in seen_nodes:
            seen_nodes.add(cash_node_id)
            graph_nodes.append({
                "id": cash_node_id,
                "account": "Cash-Out (ATM/POS)",
                "masked_account": "ATM / POS Dispersal",
                "bank": "Cash Dispenser / Merchant",
                "holder_name": "Physical Cash Out",
                "layer": 3,
                "role": "Terminal Account",
                "is_terminal": True,
                "terminal_status": "Possible Cash-Out — Evidence Required",
                "total_incoming": cash_withdrawal,
                "total_outgoing": 0.0,
                "held_amount": 0.0,
                "withdrawn_amount": cash_withdrawal,
                "unresolved_amount": 0.0,
                "tx_count": sum(1 for r in filtered_records if r["direction"] == "WITHDRAWAL"),
                "last_transaction_date": last_date or "Not available",
            })
        graph_edges.append({
            "id": "edge_cash_dispersal",
            "source": selected_acc,
            "target": cash_node_id,
            "amount": cash_withdrawal,
            "disputed_amount": cash_withdrawal,
            "utr": "Cash-Out Voucher",
            "date": last_date or "Not available",
            "datetime": last_date or "Not available",
            "source_bank": selected_meta.get("bank", "Bank"),
            "dest_bank": "Cash Network",
            "layer_from": subject_layer,
            "layer_to": 3,
            "status": "CONFIRMED",
            "is_cycle": False,
            "evidence": ["ATM/POS/Cheque worksheet records"],
            "rationale": f"Total ₹{cash_withdrawal:,.2f} cashed out via physical channels.",
            "missing_fields": [],
            "remarks": "Cash Dispersal",
            "source_sheet": "ATM/POS",
            "source_row": 0,
            "tx_id": 0,
        })

    # Statutory hold endpoint
    if verified_held_amount > 0:
        hold_node_id = "STATUTORY_HOLD_ENDPOINT"
        if hold_node_id not in seen_nodes:
            seen_nodes.add(hold_node_id)
            graph_nodes.append({
                "id": hold_node_id,
                "account": "Statutory Hold",
                "masked_account": "Bank Lien / Hold",
                "bank": selected_meta.get("bank", "Bank"),
                "holder_name": "Judicial Lien",
                "layer": 3,
                "role": "Terminal Account",
                "is_terminal": True,
                "terminal_status": "Secured under Statutory Lien",
                "total_incoming": verified_held_amount,
                "total_outgoing": 0.0,
                "held_amount": verified_held_amount,
                "withdrawn_amount": 0.0,
                "unresolved_amount": 0.0,
                "tx_count": sum(1 for r in filtered_records if r["direction"] == "HOLD"),
                "last_transaction_date": last_date or "Not available",
            })
        graph_edges.append({
            "id": "edge_hold_lien",
            "source": selected_acc,
            "target": hold_node_id,
            "amount": verified_held_amount,
            "disputed_amount": verified_held_amount,
            "utr": "Lien Notice",
            "date": last_date or "Not available",
            "datetime": last_date or "Not available",
            "source_bank": selected_meta.get("bank", "Bank"),
            "dest_bank": selected_meta.get("bank", "Bank"),
            "layer_from": subject_layer,
            "layer_to": 3,
            "status": "CONFIRMED",
            "is_cycle": False,
            "evidence": ["Put on Hold worksheet entries"],
            "rationale": f"₹{verified_held_amount:,.2f} secured under statutory hold.",
            "missing_fields": [],
            "remarks": "Bank Lien",
            "source_sheet": "Hold",
            "source_row": 0,
            "tx_id": 0,
        })

    return {
        "file_id": file_id,
        "case_id": case_id or 0,
        "filename": filename,
        "acknowledgement_no": file_obj.transactions[0].acknowledgement_no if file_obj and file_obj.transactions else None,
        "generated_at": now_iso,
        "report_title": "NCRP Account Activity & Exit Report",
        "selected_account": selected_acc,
        "selected_account_masked": mask_account_number(selected_acc),
        "available_accounts": available_accounts,
        "filters_applied": {
            "layer_filter": layer_filter or "ALL",
            "tx_type_filter": tx_type_filter or "ALL",
            "date_from": date_from,
            "date_to": date_to,
            "rapid_threshold_mins": rapid_threshold_mins,
        },
        "kpi_cards": kpi_cards,
        "account_profile": account_profile,
        "timeline_transactions": filtered_records,
        "incoming_vs_outgoing": {
            "daily_timeline": daily_timeline,
            "summary_table": summary_table,
        },
        "rapid_fund_movement": {
            "records": rapid_movement_records,
            "threshold_counts": threshold_counts,
        },
        "exit_activity": {
            "destinations": detailed_exits,
            "top_destinations": top_destinations,
        },
        "last_traceable_activity": last_traceable_activity,
        "amount_reconciliation": amount_reconciliation,
        "suspicious_indicators": suspicious_indicators,
        "data_quality_gaps": data_quality_gaps,
        "suggested_actions": suggested_actions,
        "graph_data": {
            "nodes": graph_nodes,
            "edges": graph_edges,
        },
    }

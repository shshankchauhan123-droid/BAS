from collections import Counter, deque
from datetime import datetime
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import cast, func, or_, String
from sqlalchemy.orm import Session

from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction


def normalize_account_identifier(val: Any) -> str:
    """Normalize account/wallet identifiers by stripping leading placeholder delimiters
    like '-:', '_:', ':', while strictly preserving leading zeros for string account numbers."""
    if val is None:
        return ""
    s = str(val).strip()
    s = re.sub(r"^[-_:\s]+", "", s).strip()
    return s


def mask_account_number(val: Any) -> str:
    """Mask account number showing first 2 and last 4 digits (e.g. 12XXXXXX3456).
    If length is <= 6, show partial mask or string as-is."""
    if not val:
        return ""
    s = str(val).strip()
    if len(s) <= 4:
        return s
    if len(s) <= 6:
        return s[:1] + "X" * (len(s) - 2) + s[-1:]
    return s[:2] + "X" * (len(s) - 6) + s[-4:]


def create_ncrp_file(db: Session, ncrp_file: NcrpFile) -> NcrpFile:
    db.add(ncrp_file)
    db.commit()
    db.refresh(ncrp_file)
    return ncrp_file


def get_ncrp_file_by_id(db: Session, file_id: int) -> Optional[NcrpFile]:
    return db.query(NcrpFile).filter(NcrpFile.id == file_id).first()


def get_ncrp_files_by_case(db: Session, case_id: int) -> List[NcrpFile]:
    return (
        db.query(NcrpFile)
        .filter(NcrpFile.case_id == case_id)
        .order_by(NcrpFile.created_at.desc())
        .all()
    )


def bulk_insert_ncrp_transactions(
    db: Session, transactions: List[NcrpTransaction]
) -> None:
    if not transactions:
        return
    db.bulk_save_objects(transactions)
    db.commit()


def delete_ncrp_file(db: Session, file_id: int) -> bool:
    file = db.query(NcrpFile).filter(NcrpFile.id == file_id).first()
    if not file:
        return False
    db.delete(file)
    db.commit()
    return True


def repair_ncrp_file_transactions(
    db: Session,
    file_id: int,
    case_id: int,
    new_transactions: List[NcrpTransaction],
) -> int:
    """Atomically delete existing transactions for target (file_id, case_id) and insert new ones.

    Scoped strictly to file_id and case_id within an existing transaction.
    """
    db.query(NcrpTransaction).filter(
        NcrpTransaction.ncrp_file_id == file_id,
        NcrpTransaction.case_id == case_id,
    ).delete(synchronize_session=False)
    db.flush()

    BATCH_SIZE = 1000
    for i in range(0, len(new_transactions), BATCH_SIZE):
        chunk = new_transactions[i : i + BATCH_SIZE]
        db.bulk_save_objects(chunk)
        db.flush()

    return len(new_transactions)


def get_ncrp_transactions_by_file(
    db: Session, file_id: int, skip: int = 0, limit: int = 100
) -> List[NcrpTransaction]:
    return (
        db.query(NcrpTransaction)
        .filter(NcrpTransaction.ncrp_file_id == file_id)
        .order_by(NcrpTransaction.sheet_name.asc(), NcrpTransaction.row_number.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_ncrp_transactions_paginated(
    db: Session,
    file_id: int,
    case_id: Optional[int] = None,
    sheet_name: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    bank_name: Optional[str] = None,
    layer: Optional[str] = None,
    acknowledgement_no: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    sort_by: str = "row_number",
    sort_order: str = "asc",
) -> Dict[str, Any]:
    """Retrieve NCRP transactions with sheet filtering, search, date range, amount range,

    bank, layer, acknowledgement, pagination, and totals.
    """
    base_file_query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        base_file_query = base_file_query.filter(NcrpTransaction.case_id == case_id)

    # 1. Distinct sheet names, bank names, layers, and acknowledgement numbers
    distinct_sheets = [
        s[0]
        for s in (
            base_file_query.with_entities(NcrpTransaction.sheet_name)
            .distinct()
            .order_by(NcrpTransaction.sheet_name.asc())
            .all()
        )
        if s[0]
    ]

    distinct_banks_query = [
        b[0]
        for b in (
            base_file_query.with_entities(NcrpTransaction.bank_name)
            .distinct()
            .order_by(NcrpTransaction.bank_name.asc())
            .all()
        )
        if b[0]
    ]

    # Include any Action Banks from raw_data so users can filter by all banks present
    banks_set = set(distinct_banks_query)
    for tx in base_file_query.all():
        if tx.raw_data:
            ab = (
                tx.raw_data.get("Action Taken By bank")
                or tx.raw_data.get("Action Taken by Bank")
                or tx.raw_data.get("action_taken_by_bank")
            )
            if ab and str(ab).strip() and str(ab).strip() not in banks_set:
                banks_set.add(str(ab).strip())
            bn = tx.raw_data.get("Bank/FIs") or tx.raw_data.get("bank_name")
            if bn and str(bn).strip() and str(bn).strip() not in banks_set:
                banks_set.add(str(bn).strip())
    distinct_banks = sorted(list(banks_set))

    distinct_layers = [
        l[0]
        for l in (
            base_file_query.with_entities(NcrpTransaction.layer)
            .distinct()
            .order_by(NcrpTransaction.layer.asc())
            .all()
        )
        if l[0]
    ]

    distinct_acknowledgements = [
        a[0]
        for a in (
            base_file_query.with_entities(NcrpTransaction.acknowledgement_no)
            .distinct()
            .order_by(NcrpTransaction.acknowledgement_no.asc())
            .all()
        )
        if a[0]
    ]

    # Query for filtering rows
    query = base_file_query

    # 2. Sheet filter
    if sheet_name and sheet_name.strip() and sheet_name.strip() != "ALL":
        query = query.filter(NcrpTransaction.sheet_name == sheet_name.strip())

    # 3. Bank name filter (searches bank_name or raw_data)
    if bank_name and bank_name.strip() and bank_name.strip() != "ALL":
        b_term = f"%{bank_name.strip()}%"
        query = query.filter(
            or_(
                NcrpTransaction.bank_name.ilike(b_term),
                cast(NcrpTransaction.raw_data, String).ilike(b_term),
            )
        )

    # 4. Layer filter
    if layer and layer.strip() and layer.strip() != "ALL":
        l_str = layer.strip()
        l_digits = "".join(c for c in l_str if c.isdigit())
        if l_digits:
            query = query.filter(
                or_(
                    NcrpTransaction.layer == l_digits,
                    NcrpTransaction.layer == f"Layer {l_digits}",
                    NcrpTransaction.layer == l_str,
                    NcrpTransaction.layer.ilike(f"%{l_str}%"),
                )
            )
        else:
            query = query.filter(NcrpTransaction.layer.ilike(f"%{l_str}%"))

    # 5. Acknowledgement number filter
    if acknowledgement_no and acknowledgement_no.strip() and acknowledgement_no.strip() != "ALL":
        query = query.filter(NcrpTransaction.acknowledgement_no == acknowledgement_no.strip())

    # 6. Search filter across text/identifier columns and raw_data
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                NcrpTransaction.acknowledgement_no.ilike(term),
                NcrpTransaction.account_or_wallet_id.ilike(term),
                NcrpTransaction.transaction_id_utr.ilike(term),
                NcrpTransaction.bank_name.ilike(term),
                NcrpTransaction.layer.ilike(term),
                NcrpTransaction.sheet_name.ilike(term),
                cast(NcrpTransaction.raw_data, String).ilike(term),
            )
        )

    # 7. Transaction date range
    if date_from and str(date_from).strip():
        try:
            clean_date = str(date_from).strip().split("T")[0]
            dt_from = datetime.strptime(clean_date, "%Y-%m-%d")
            query = query.filter(NcrpTransaction.transaction_date >= dt_from)
        except Exception:
            pass

    if date_to and str(date_to).strip():
        try:
            clean_date = str(date_to).strip().split("T")[0]
            dt_to = datetime.strptime(clean_date, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            query = query.filter(NcrpTransaction.transaction_date <= dt_to)
        except Exception:
            pass

    # 8. Amount range
    if min_amount is not None:
        try:
            query = query.filter(NcrpTransaction.transaction_amount >= float(min_amount))
        except (ValueError, TypeError):
            pass

    if max_amount is not None:
        try:
            query = query.filter(NcrpTransaction.transaction_amount <= float(max_amount))
        except (ValueError, TypeError):
            pass

    # 9. Total count of filtered transactions
    total = query.count()

    # 10. Financial summary calculation on filtered set
    summary_query = query.with_entities(
        func.coalesce(func.sum(NcrpTransaction.transaction_amount), 0),
        func.coalesce(func.sum(NcrpTransaction.disputed_amount), 0),
    )
    sum_row = summary_query.first()
    total_amount = sum_row[0] if sum_row else 0
    total_disputed = sum_row[1] if sum_row else 0

    # 11. Sorting
    allowed_sort_fields = {
        "id": NcrpTransaction.id,
        "row_number": NcrpTransaction.row_number,
        "sheet_name": NcrpTransaction.sheet_name,
        "transaction_date": NcrpTransaction.transaction_date,
        "transaction_amount": NcrpTransaction.transaction_amount,
        "disputed_amount": NcrpTransaction.disputed_amount,
        "bank_name": NcrpTransaction.bank_name,
        "layer": NcrpTransaction.layer,
        "acknowledgement_no": NcrpTransaction.acknowledgement_no,
        "transaction_id_utr": NcrpTransaction.transaction_id_utr,
    }
    col = allowed_sort_fields.get(sort_by, NcrpTransaction.row_number)
    if str(sort_order).lower() == "desc":
        query = query.order_by(col.desc(), NcrpTransaction.row_number.desc())
    else:
        query = query.order_by(col.asc(), NcrpTransaction.row_number.asc())

    # 12. Pagination
    items = query.offset(skip).limit(limit).all()

    page = (skip // limit) + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 0

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "page": page,
        "total_pages": total_pages,
        "sheets": distinct_sheets,
        "banks": distinct_banks,
        "layers": distinct_layers,
        "acknowledgements": distinct_acknowledgements,
        "summary": {
            "total_amount": total_amount,
            "total_disputed_amount": total_disputed,
        },
        "items": items,
    }


def get_ncrp_sankey_data(
    db: Session,
    file_id: int,
    case_id: Optional[int] = None,
    layer: Optional[str] = None,
    acknowledgement_no: Optional[str] = None,
    sheet_name: Optional[str] = None,
    bank_name: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    money_transfer_only: bool = False,
) -> Dict[str, Any]:
    """Aggregate NCRP transactions into layer-wise Sankey nodes, links, and KPI metrics.

    Guaranteed cycle-free DAG by assigning nodes with layer-stage context.
    When money_transfer_only is True, strictly restricts to 'Money Transfer to' records
    and excludes incomplete records without fabricating endpoints.
    """
    base_file_query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        base_file_query = base_file_query.filter(NcrpTransaction.case_id == case_id)

    if money_transfer_only:
        base_file_query = base_file_query.filter(NcrpTransaction.sheet_name.ilike("money transfer%"))

    # 1. Inspect all transactions for this file to compute dynamic layer summaries and distinct filters
    all_file_txs = base_file_query.all()

    distinct_sheets_set = set()
    distinct_banks_set = set()
    distinct_layers_set = set()
    distinct_ack_set = set()
    layer_groups: Dict[int, Dict[str, Any]] = {}

    for tx in all_file_txs:
        raw = tx.raw_data or {}
        if tx.sheet_name:
            distinct_sheets_set.add(tx.sheet_name)
        if tx.bank_name:
            distinct_banks_set.add(tx.bank_name)
        if tx.layer:
            distinct_layers_set.add(tx.layer)
        if tx.acknowledgement_no:
            distinct_ack_set.add(tx.acknowledgement_no)

        # Check raw_data for additional banks
        ab = (
            raw.get("Action Taken By bank")
            or raw.get("Action Taken by Bank")
            or raw.get("action_taken_by_bank")
        )
        if ab and str(ab).strip():
            distinct_banks_set.add(str(ab).strip())
        bn = raw.get("Bank/FIs") or raw.get("bank_name")
        if bn and str(bn).strip():
            distinct_banks_set.add(str(bn).strip())

        # Layer grouping for dynamic layer summary cards
        l_raw = str(tx.layer or "1").strip()
        l_digits = "".join(c for c in l_raw if c.isdigit())
        l_num = int(l_digits) if l_digits else 1

        src_acc = normalize_account_identifier(tx.account_or_wallet_id)
        sheet_str = tx.sheet_name or ""
        is_mt = "money transfer" in sheet_str.lower()
        if is_mt:
            dest_acc = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        elif "atm" in sheet_str.lower():
            dest_acc = f"ATM: {raw.get('ATM ID') or 'Cash'}"
        elif "pos" in sheet_str.lower():
            dest_acc = f"POS: {raw.get('Merchant Name') or 'Terminal'}"
        elif "cheque" in sheet_str.lower():
            dest_acc = f"Cheque: {raw.get('Cheque No') or 'Cash'}"
        else:
            dest_acc = normalize_account_identifier(raw.get("Account No"))

        # In money_transfer_only mode, require valid non-placeholder endpoints
        if money_transfer_only:
            if not src_acc or src_acc in ["-", "None", "null", "Unknown Source", ""] or not dest_acc or dest_acc in ["-", "None", "null", "Unknown / Pending Account", ""]:
                continue

        if l_num not in layer_groups:
            layer_groups[l_num] = {
                "layer": f"Layer {l_num}",
                "layer_num": l_num,
                "transaction_count": 0,
                "senders": set(),
                "receivers": set(),
                "total_amount": 0.0,
                "total_disputed": 0.0,
            }

        layer_groups[l_num]["transaction_count"] += 1
        if src_acc and src_acc not in ["-", "None", "null"]:
            layer_groups[l_num]["senders"].add(src_acc)
        if dest_acc and dest_acc not in ["-", "None", "null"]:
            layer_groups[l_num]["receivers"].add(dest_acc)
        layer_groups[l_num]["total_amount"] += float(tx.transaction_amount or 0.0)
        layer_groups[l_num]["total_disputed"] += float(tx.disputed_amount or 0.0)

    # Sort layer summaries by numeric layer
    layer_summaries = [
        {
            "layer": g["layer"],
            "layer_num": g["layer_num"],
            "transaction_count": g["transaction_count"],
            "unique_senders": len(g["senders"]),
            "unique_receivers": len(g["receivers"]),
            "total_amount": round(g["total_amount"], 2),
            "total_disputed": round(g["total_disputed"], 2),
            "distinct_accounts": len(g["senders"].union(g["receivers"])),
        }
        for g in sorted(layer_groups.values(), key=lambda x: x["layer_num"])
    ]

    distinct_sheets = sorted(list(distinct_sheets_set))
    distinct_banks = sorted(list(distinct_banks_set))
    distinct_layers = sorted(list(distinct_layers_set), key=lambda x: int("".join(c for c in x if c.isdigit()) or 99))
    distinct_acknowledgements = sorted(list(distinct_ack_set))

    # 2. Build filtered query
    query = base_file_query

    if sheet_name and sheet_name.strip() and sheet_name.strip() != "ALL":
        query = query.filter(NcrpTransaction.sheet_name == sheet_name.strip())

    if bank_name and bank_name.strip() and bank_name.strip() != "ALL":
        b_term = f"%{bank_name.strip()}%"
        query = query.filter(
            or_(
                NcrpTransaction.bank_name.ilike(b_term),
                cast(NcrpTransaction.raw_data, String).ilike(b_term),
            )
        )

    if layer and layer.strip() and layer.strip() != "ALL":
        l_str = layer.strip()
        l_digits = "".join(c for c in l_str if c.isdigit())
        if l_digits:
            query = query.filter(
                or_(
                    NcrpTransaction.layer == l_digits,
                    NcrpTransaction.layer == f"Layer {l_digits}",
                    NcrpTransaction.layer == l_str,
                    NcrpTransaction.layer.ilike(f"%{l_str}%"),
                )
            )
        else:
            query = query.filter(NcrpTransaction.layer.ilike(f"%{l_str}%"))

    if acknowledgement_no and acknowledgement_no.strip() and acknowledgement_no.strip() != "ALL":
        query = query.filter(NcrpTransaction.acknowledgement_no == acknowledgement_no.strip())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                NcrpTransaction.acknowledgement_no.ilike(term),
                NcrpTransaction.account_or_wallet_id.ilike(term),
                NcrpTransaction.transaction_id_utr.ilike(term),
                NcrpTransaction.bank_name.ilike(term),
                NcrpTransaction.layer.ilike(term),
                NcrpTransaction.sheet_name.ilike(term),
                cast(NcrpTransaction.raw_data, String).ilike(term),
            )
        )

    if date_from and str(date_from).strip():
        try:
            clean_date = str(date_from).strip().split("T")[0]
            dt_from = datetime.strptime(clean_date, "%Y-%m-%d")
            query = query.filter(NcrpTransaction.transaction_date >= dt_from)
        except Exception:
            pass

    if date_to and str(date_to).strip():
        try:
            clean_date = str(date_to).strip().split("T")[0]
            dt_to = datetime.strptime(clean_date, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            query = query.filter(NcrpTransaction.transaction_date <= dt_to)
        except Exception:
            pass

    if min_amount is not None:
        try:
            query = query.filter(NcrpTransaction.transaction_amount >= float(min_amount))
        except (ValueError, TypeError):
            pass

    if max_amount is not None:
        try:
            query = query.filter(NcrpTransaction.transaction_amount <= float(max_amount))
        except (ValueError, TypeError):
            pass

    transactions = query.order_by(NcrpTransaction.row_number.asc()).all()

    # 3. Aggregate into layer-based nodes and combined links
    nodes_map: Dict[str, Dict[str, Any]] = {}
    links_map: Dict[tuple, Dict[str, Any]] = {}

    source_accounts_set = set()
    dest_accounts_set = set()
    layers_represented_set = set()
    total_tx_amount = 0.0
    total_disp_amount = 0.0
    unknown_or_hold_count = 0

    for t in transactions:
        raw = t.raw_data or {}
        tx_amt = float(t.transaction_amount or 0.0)
        disp_amt = float(t.disputed_amount or 0.0)

        layer_raw = str(t.layer or "1").strip()
        layer_digits = "".join(c for c in layer_raw if c.isdigit())
        layer_num = int(layer_digits) if layer_digits else 1

        src_acc = normalize_account_identifier(t.account_or_wallet_id)
        src_bank = (
            raw.get("Action Taken By bank")
            or raw.get("action_taken_by_bank")
            or raw.get("Action Taken by Bank")
            or t.bank_name
            or "Source Bank"
        )

        sheet = t.sheet_name or ""

        if money_transfer_only:
            dest_acc = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
            # If missing sender or receiver or empty or "-", strictly exclude row from graph
            if not src_acc or src_acc in ["-", "None", "null", "Unknown Source", ""] or not dest_acc or dest_acc in ["-", "None", "null", "Unknown / Pending Account", ""]:
                unknown_or_hold_count += 1
                continue

            dest_bank = t.bank_name or raw.get("Bank/FIs") or "Destination Bank"
            dest_accounts_set.add(dest_acc)
            source_accounts_set.add(src_acc)
            layers_represented_set.add(f"Layer {layer_num}")
            total_tx_amount += tx_amt
            total_disp_amount += disp_amt
        else:
            total_tx_amount += tx_amt
            total_disp_amount += disp_amt
            layers_represented_set.add(f"Layer {layer_num}")
            if src_acc and src_acc != "-":
                source_accounts_set.add(src_acc)

            dest_acc = None
            dest_bank = t.bank_name or raw.get("Bank/FIs") or "Destination Bank"

            if sheet == "Money Transfer to" or sheet.lower().startswith("money transfer"):
                dest_acc = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
                if not dest_acc or dest_acc == "-":
                    dest_acc = "Unknown / Pending Account"
                    unknown_or_hold_count += 1
                else:
                    dest_accounts_set.add(dest_acc)
            elif sheet == "Withdrawal through ATM":
                atm = raw.get("ATM ID") or raw.get("Place/Location of ATM") or "Cash"
                dest_acc = f"ATM: {atm}"
                dest_bank = src_bank or "ATM Terminal"
                dest_accounts_set.add(dest_acc)
            elif sheet == "Withdrawal through POS":
                pos = raw.get("Merchant Name") or raw.get("MID") or "Terminal"
                dest_acc = f"POS: {pos}"
                dest_bank = src_bank or "POS Merchant"
                dest_accounts_set.add(dest_acc)
            elif sheet == "Cash Withdrawal through Cheque":
                chq = raw.get("Cheque No") or "Cash"
                dest_acc = f"Cheque: {chq}"
                dest_bank = src_bank or "Cheque Counter"
                dest_accounts_set.add(dest_acc)
            elif sheet == "Transaction put on hold":
                dest_acc = None
                unknown_or_hold_count += 1
            else:
                dest_acc = normalize_account_identifier(raw.get("Account No") or "Other / Pending Account")
                dest_accounts_set.add(dest_acc)

        if dest_acc:
            src_layer = max(0, layer_num - 1)
            tgt_layer = layer_num

            src_id = f"L{src_layer}: {src_acc}"
            tgt_id = f"L{tgt_layer}: {dest_acc}"

            # Nodes mapping
            if src_id not in nodes_map:
                nodes_map[src_id] = {
                    "id": src_id,
                    "name": src_id,
                    "account": src_acc,
                    "bank": src_bank,
                    "layer": f"Layer {src_layer}" if src_layer > 0 else "Source / Origin",
                    "layer_num": src_layer,
                    "total_in": 0.0,
                    "total_out": 0.0,
                    "disputed_in": 0.0,
                    "disputed_out": 0.0,
                    "tx_count": 0,
                }
            nodes_map[src_id]["total_out"] += tx_amt
            nodes_map[src_id]["disputed_out"] += disp_amt
            nodes_map[src_id]["tx_count"] += 1

            if tgt_id not in nodes_map:
                nodes_map[tgt_id] = {
                    "id": tgt_id,
                    "name": tgt_id,
                    "account": dest_acc,
                    "bank": dest_bank,
                    "layer": f"Layer {tgt_layer}",
                    "layer_num": tgt_layer,
                    "total_in": 0.0,
                    "total_out": 0.0,
                    "disputed_in": 0.0,
                    "disputed_out": 0.0,
                    "tx_count": 0,
                }
            nodes_map[tgt_id]["total_in"] += tx_amt
            nodes_map[tgt_id]["disputed_in"] += disp_amt
            nodes_map[tgt_id]["tx_count"] += 1

            # Links aggregation
            link_key = (src_id, tgt_id)
            if link_key not in links_map:
                links_map[link_key] = {
                    "source": src_id,
                    "target": tgt_id,
                    "value": 0.0,
                    "disputed_value": 0.0,
                    "layer": f"Layer {layer_num}",
                    "layer_num": layer_num,
                    "source_acc": src_acc,
                    "target_acc": dest_acc,
                    "source_bank": src_bank,
                    "target_bank": dest_bank,
                    "sheet": sheet,
                    "utr": t.transaction_id_utr,
                    "source_utr": raw.get("source_utr") or raw.get("Transaction Id / UTR Number"),
                    "ifsc": raw.get("Ifsc Code") or raw.get("ifsc_code") or raw.get("IFSC Code") or raw.get("IFSC"),
                    "ref_no": raw.get("Reference No") or raw.get("reference_no") or raw.get("Ref No"),
                    "remarks": raw.get("Remarks") or raw.get("remarks"),
                    "ack_no": t.acknowledgement_no,
                    "date": str(t.transaction_date) if t.transaction_date else None,
                    "tx_count": 0,
                    "tx_ids": [],
                    "transactions": [],
                }
            links_map[link_key]["value"] += tx_amt
            links_map[link_key]["disputed_value"] += disp_amt
            links_map[link_key]["tx_count"] += 1
            links_map[link_key]["tx_ids"].append(t.id)

            tx_item = {
                "id": t.id,
                "row_number": t.row_number,
                "sheet": sheet,
                "source_acc": src_acc,
                "source_bank": src_bank,
                "target_acc": dest_acc,
                "target_bank": dest_bank,
                "amount": tx_amt,
                "disputed_amount": disp_amt,
                "date": str(t.transaction_date) if t.transaction_date else None,
                "utr": t.transaction_id_utr or raw.get("Transaction Id / UTR Number") or raw.get("source_utr"),
                "ack_no": t.acknowledgement_no,
                "remarks": raw.get("Remarks") or raw.get("remarks"),
                "ref_no": raw.get("Reference No") or raw.get("reference_no") or raw.get("Ref No"),
                "ifsc": raw.get("Ifsc Code") or raw.get("ifsc_code") or raw.get("IFSC Code") or raw.get("IFSC"),
                "layer": f"Layer {layer_num}",
                "layer_num": layer_num,
            }
            links_map[link_key]["transactions"].append(tx_item)

    # Sort nodes and links
    sorted_nodes = sorted(nodes_map.values(), key=lambda n: (n["layer_num"], n["account"]))
    sorted_links = sorted(links_map.values(), key=lambda l: (l["layer_num"], -l["value"]))

    eligible_count = sum(l["tx_count"] for l in links_map.values())
    kpis = {
        "total_transactions": eligible_count if money_transfer_only else len(transactions),
        "unique_source_accounts": len(source_accounts_set),
        "unique_destination_accounts": len(dest_accounts_set),
        "total_transaction_amount": round(total_tx_amount, 2),
        "total_disputed_amount": round(total_disp_amount, 2),
        "total_layers": len(layers_represented_set),
        "layers_represented": sorted(list(layers_represented_set)),
        "unknown_or_hold_flow_count": unknown_or_hold_count,
        "excluded_incomplete_count": unknown_or_hold_count,
    }

    return {
        "nodes": sorted_nodes,
        "links": sorted_links,
        "kpis": kpis,
        "layer_summaries": layer_summaries,
        "available_layers": distinct_layers,
        "available_acknowledgements": distinct_acknowledgements,
        "available_banks": distinct_banks,
        "available_sheets": distinct_sheets,
    }


def categorize_ncrp_sheet(sheet_name: str) -> str:
    s = (sheet_name or "").strip().lower()
    if "money transfer" in s:
        return "Money Transfer"
    if "atm" in s:
        return "ATM Withdrawal"
    if "pos" in s:
        return "POS Withdrawal"
    if "cheque" in s or "check" in s:
        return "Cheque Withdrawal"
    if "hold" in s:
        return "Hold Action"
    return "Other"


def get_ncrp_layer_activity_breakdown(
    db: Session,
    file_id: int,
    case_id: Optional[int] = None,
    layer: Optional[str] = None,
) -> Dict[str, Any]:
    """Calculate worksheet-aware, layer-wise KPIs and category breakdown without double-counting."""
    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)

    if layer is not None and str(layer).strip() and str(layer).strip().upper() != "ALL":
        l_str = str(layer).strip()
        l_digits = "".join(c for c in l_str if c.isdigit())
        if l_digits:
            query = query.filter(
                or_(
                    NcrpTransaction.layer == l_digits,
                    NcrpTransaction.layer == f"Layer {l_digits}",
                    NcrpTransaction.layer.ilike(f"%{l_str}%"),
                )
            )
        else:
            query = query.filter(NcrpTransaction.layer.ilike(f"%{l_str}%"))

    txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    categories_map: Dict[str, Dict[str, Any]] = {}
    total_records = len(txs)
    transfer_amount = 0.0
    withdrawal_amount = 0.0
    hold_amount = 0.0
    disputed_amount = 0.0
    senders_set = set()
    receivers_set = set()
    all_accounts_set = set()

    for t in txs:
        raw = t.raw_data or {}
        cat = categorize_ncrp_sheet(t.sheet_name)
        tx_amt = float(t.transaction_amount or 0.0)
        disp_amt = float(t.disputed_amount or 0.0)
        src_acc = normalize_account_identifier(t.account_or_wallet_id)
        dest_acc = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))

        if src_acc and src_acc not in ["-", "None", "null", ""]:
            all_accounts_set.add(src_acc)
        if dest_acc and dest_acc not in ["-", "None", "null", ""]:
            all_accounts_set.add(dest_acc)

        disputed_amount += disp_amt

        if cat == "Money Transfer":
            transfer_amount += tx_amt
            if src_acc and src_acc not in ["-", "None", "null", ""]:
                senders_set.add(src_acc)
            if dest_acc and dest_acc not in ["-", "None", "null", ""]:
                receivers_set.add(dest_acc)
        elif cat in ["ATM Withdrawal", "POS Withdrawal", "Cheque Withdrawal"]:
            withdrawal_amount += tx_amt
        elif cat == "Hold Action":
            hold_amount += tx_amt

        key = cat
        if key not in categories_map:
            categories_map[key] = {
                "category": cat,
                "sheet_name": t.sheet_name,
                "count": 0,
                "total_amount": 0.0,
                "disputed_amount": 0.0,
                "hold_amount": 0.0,
                "accounts": set(),
            }
        categories_map[key]["count"] += 1
        categories_map[key]["disputed_amount"] += disp_amt
        if cat == "Hold Action":
            categories_map[key]["hold_amount"] += tx_amt
        else:
            categories_map[key]["total_amount"] += tx_amt
        if src_acc:
            categories_map[key]["accounts"].add(src_acc)
        if dest_acc:
            categories_map[key]["accounts"].add(dest_acc)

    cat_list = [
        {
            "category": c["category"],
            "sheet_name": c["sheet_name"],
            "count": c["count"],
            "record_count": c["count"],
            "total_amount": round(c["total_amount"], 2),
            "relevant_amount": round(c["hold_amount"] if c["category"] == "Hold Action" else c["total_amount"], 2),
            "disputed_amount": round(c["disputed_amount"], 2),
            "hold_amount": round(c["hold_amount"], 2),
            "unique_accounts": len(c["accounts"]),
        }
        for c in sorted(categories_map.values(), key=lambda x: -x["count"])
    ]

    return {
        "file_id": file_id,
        "case_id": case_id or 0,
        "layer": layer,
        "kpis": {
            "total_records": total_records,
            "transfer_amount": round(transfer_amount, 2),
            "withdrawal_amount": round(withdrawal_amount, 2),
            "hold_amount": round(hold_amount, 2),
            "disputed_amount": round(disputed_amount, 2),
            "unique_senders": len(senders_set),
            "unique_receivers": len(receivers_set),
            "unique_accounts": len(all_accounts_set),
        },
        "categories": cat_list,
    }


def get_ncrp_path_transactions(
    all_mt_txs: List[NcrpTransaction],
    root_account: str,
) -> tuple:
    """
    Computes directed reachability and UTR traceability from root_account
    in the Money Transfer To worksheet records.
    Returns:
      path_tx_ids: Set[int]
      path_accounts: Set[str]
      path_utrs: Set[str]
    """
    norm_root = normalize_account_identifier(root_account)
    path_tx_ids = set()
    path_accounts = {norm_root}
    path_utrs = set()

    for t in all_mt_txs:
        raw = t.raw_data or {}
        src = normalize_account_identifier(t.account_or_wallet_id)
        dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        l_str = str(t.layer or "1")
        l_num = int("".join(c for c in l_str if c.isdigit()) or 1)
        if l_num == 1 and src == norm_root:
            path_tx_ids.add(t.id)
            if dest:
                path_accounts.add(dest)
            for u in [
                t.transaction_id_utr,
                raw.get("source_utr"),
                raw.get("Transaction ID / UTR Number"),
                raw.get("Transaction Id / UTR Number"),
            ]:
                if u and str(u).strip():
                    path_utrs.add(str(u).strip())

    changed = True
    while changed:
        changed = False
        for t in all_mt_txs:
            if t.id in path_tx_ids:
                continue
            raw = t.raw_data or {}
            src = normalize_account_identifier(t.account_or_wallet_id)
            dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
            l_str = str(t.layer or "1")
            l_num = int("".join(c for c in l_str if c.isdigit()) or 1)
            if l_num <= 1:
                continue

            if src in path_accounts:
                src_utr = str(raw.get("source_utr") or "").strip()
                if src_utr:
                    if src_utr in path_utrs:
                        path_tx_ids.add(t.id)
                        if dest:
                            path_accounts.add(dest)
                        for u in [
                            t.transaction_id_utr,
                            raw.get("Transaction ID / UTR Number"),
                            raw.get("Transaction Id / UTR Number"),
                        ]:
                            if u and str(u).strip():
                                path_utrs.add(str(u).strip())
                        changed = True
                else:
                    path_tx_ids.add(t.id)
                    if dest:
                        path_accounts.add(dest)
                    for u in [
                        t.transaction_id_utr,
                        raw.get("Transaction ID / UTR Number"),
                        raw.get("Transaction Id / UTR Number"),
                    ]:
                        if u and str(u).strip():
                            path_utrs.add(str(u).strip())
                    changed = True

    return path_tx_ids, path_accounts, path_utrs


def get_ncrp_account_profile_data(
    db: Session,
    file_id: int,
    account: str,
    case_id: Optional[int] = None,
    layer: Optional[str] = None,
    money_transfer_only: bool = False,
    root_account: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve complete 360-degree account profile, separating path-specific from account-wide metrics."""
    acc_norm = normalize_account_identifier(account)
    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    if money_transfer_only:
        query = query.filter(NcrpTransaction.sheet_name.ilike('%money%transfer%'))
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    # Precalculate path transactions if root_account is specified
    path_tx_ids = None
    if root_account:
        all_mt_txs = [t for t in all_txs if categorize_ncrp_sheet(t.sheet_name) == "Money Transfer"]
        p_ids, _, _ = get_ncrp_path_transactions(all_mt_txs, root_account)
        path_tx_ids = p_ids

    account_bank = None
    account_holder = None
    account_ifsc = None
    account_ack_no = None

    # Path-specific sums (default primary KPIs)
    total_in_amount = 0.0
    total_out_amount = 0.0
    total_withdrawal_amount = 0.0
    total_hold_amount = 0.0
    total_disputed_amount = 0.0
    incoming_txs = []
    outgoing_txs = []
    withdrawal_txs = []
    hold_txs = []
    all_account_txs = []
    layers_seen = set()
    explicit_layers_seen = set()

    # Account-wide sums across all branches
    account_wide_total_in = 0.0
    account_wide_total_out = 0.0
    account_wide_money_transfers = []
    unrelated_money_transfers = []
    unrelated_incoming = []
    unrelated_outgoing = []

    # The 6 NCRP Worksheets collections
    money_transfers = []
    pos_withdrawals = []
    atm_withdrawals = []
    cheque_withdrawals = []
    hold_records = []
    other_records = []

    for t in all_txs:
        raw = t.raw_data or {}
        src = normalize_account_identifier(t.account_or_wallet_id)
        dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        raw_account = normalize_account_identifier(
            raw.get("Account No")
            or raw.get("account_no")
            or raw.get("Account Number")
            or raw.get("Account No / Wallet / PG / PA ID")
            or raw.get("Account No/ Wallet/ PG/ PA ID")
            or raw.get("Beneficiary Account No")
            or raw.get("Suspect Account No")
        )
        cat = categorize_ncrp_sheet(t.sheet_name)
        amt = float(t.transaction_amount or 0.0)
        disp = float(t.disputed_amount or 0.0)
        l_str = str(t.layer or "1")
        l_num = int("".join(c for c in l_str if c.isdigit()) or 1)
        layer_label = f"Layer {l_num}"

        is_sender = (src == acc_norm)
        is_receiver = (dest == acc_norm or raw_account == acc_norm)

        if not is_sender and not is_receiver:
            continue

        layers_seen.add(layer_label)
        if t.layer and str(t.layer).strip():
            explicit_layers_seen.add(f"Layer {l_num}")

        if not account_bank:
            if is_sender:
                account_bank = (
                    raw.get("Action Taken By bank")
                    or raw.get("action_taken_by_bank")
                    or t.bank_name
                )
            elif is_receiver:
                account_bank = t.bank_name or raw.get("Bank/FIs") or raw.get("Action Taken By bank")

        if not account_holder:
            account_holder = (
                raw.get("Account Holder Name")
                or raw.get("Account Name")
                or raw.get("Customer Name")
                or raw.get("Name of Acc Holder")
                or raw.get("name")
            )
        if not account_ifsc:
            account_ifsc = raw.get("IFSC") or raw.get("ifsc") or raw.get("IFSC Code") or raw.get("Ifsc Code") or raw.get("Ifsc")
        if not account_ack_no:
            account_ack_no = t.acknowledgement_no or raw.get("Acknowledgement No") or raw.get("ack_no")

        hold_val = float(raw.get("Put on Hold Amount") or raw.get("Put on hold Amount") or raw.get("Hold Amount") or amt or 0.0) if cat == "Hold Action" else 0.0
        hold_dt = raw.get("Put on hold Date") or raw.get("Date of Action") or (str(t.transaction_date).split("T")[0] if t.transaction_date else None)
        action_bank = raw.get("Action Taken By bank") or raw.get("action_taken_by_bank") or t.bank_name or "Bank / FI"
        bank_action = raw.get("Action Taken") or raw.get("Action Taken by Bank") or "Account Lien / Freeze"

        is_path_specific = (path_tx_ids is None or t.id in path_tx_ids)

        tx_summary = {
            "id": t.id,
            "row_number": t.row_number,
            "sheet_name": t.sheet_name,
            "category": cat,
            "layer": layer_label,
            "layer_num": l_num,
            "layer_recorded": f"Layer {l_num}" if t.layer else None,
            "layer_inferred": f"Layer {l_num}",
            "date": str(t.transaction_date).split("T")[0] if t.transaction_date else None,
            "amount": amt,
            "disputed_amount": disp,
            "utr": t.transaction_id_utr or raw.get("Transaction Id / UTR Number") or raw.get("source_utr") or raw.get("Reference No") or raw.get("Ref No"),
            "ack_no": t.acknowledgement_no or raw.get("Acknowledgement No"),
            "ifsc_code": raw.get("IFSC Code") or raw.get("ifsc_code") or raw.get("IFSC"),
            "sender_account": src,
            "sender_bank": raw.get("Action Taken By bank") or raw.get("action_taken_by_bank") or t.bank_name or "Source Bank",
            "receiver_account": dest or raw_account,
            "receiver_bank": t.bank_name or raw.get("Bank/FIs") or "Destination Bank",
            "direction": "OUTGOING" if is_sender else "INCOMING",
            "remarks": raw.get("Remarks") or ("Put on hold" if cat == "Hold Action" else None),
            "atm_id": raw.get("ATM ID") or raw.get("Place/Location of ATM") or raw.get("Location") or "ATM Terminal",
            "merchant_name": raw.get("Merchant Name") or raw.get("MID") or raw.get("Terminal ID") or "POS Merchant",
            "cheque_no": raw.get("Cheque No") or raw.get("Cheque Number") or raw.get("Chq No") or "Cheque",
            "branch_location": raw.get("Branch Location"),
            "hold_amount": hold_val,
            "action_date": hold_dt,
            "action_taken": bank_action,
            "hold_status": "Active Hold" if cat == "Hold Action" else None,
            "is_path_specific": is_path_specific,
            "raw_data": raw,
        }
        all_account_txs.append(tx_summary)

        # Distribute into the 6 distinct NCRP worksheets collections
        if cat == "Money Transfer":
            account_wide_money_transfers.append(tx_summary)
            if is_receiver:
                account_wide_total_in += amt
            if is_sender:
                account_wide_total_out += amt

            if is_path_specific:
                money_transfers.append(tx_summary)
                if is_receiver:
                    total_in_amount += amt
                    total_disputed_amount += disp
                    incoming_txs.append(tx_summary)
                if is_sender:
                    total_out_amount += amt
                    total_disputed_amount += disp
                    outgoing_txs.append(tx_summary)
            else:
                unrelated_money_transfers.append(tx_summary)
                if is_receiver:
                    unrelated_incoming.append(tx_summary)
                if is_sender:
                    unrelated_outgoing.append(tx_summary)
        elif cat == "POS Withdrawal":
            pos_withdrawals.append(tx_summary)
            withdrawal_txs.append(tx_summary)
            total_withdrawal_amount += amt
            total_disputed_amount += disp
        elif cat == "ATM Withdrawal":
            atm_withdrawals.append(tx_summary)
            withdrawal_txs.append(tx_summary)
            total_withdrawal_amount += amt
            total_disputed_amount += disp
        elif cat == "Cheque Withdrawal":
            cheque_withdrawals.append(tx_summary)
            withdrawal_txs.append(tx_summary)
            total_withdrawal_amount += amt
            total_disputed_amount += disp
        elif cat == "Hold Action":
            hold_records.append(tx_summary)
            hold_txs.append(tx_summary)
            total_hold_amount += hold_val
            total_disputed_amount += disp
        else:
            other_records.append(tx_summary)
            total_out_amount += amt
            total_disputed_amount += disp

    # If no root_account was provided, account-wide equals path-specific
    if path_tx_ids is None:
        account_wide_total_in = total_in_amount
        account_wide_total_out = total_out_amount
        account_wide_money_transfers = list(money_transfers)

    # Group connected counterparties for the active path
    senders_map: Dict[str, Dict[str, Any]] = {}
    for tx in incoming_txs:
        s_acc = tx["sender_account"]
        if s_acc and s_acc != acc_norm:
            if s_acc not in senders_map:
                senders_map[s_acc] = {
                    "account": s_acc,
                    "bank": tx["sender_bank"] or "Source Bank",
                    "amount": 0.0,
                    "count": 0,
                }
            senders_map[s_acc]["amount"] += tx["amount"]
            senders_map[s_acc]["count"] += 1

    receivers_map: Dict[str, Dict[str, Any]] = {}
    for tx in outgoing_txs:
        r_acc = tx["receiver_account"]
        if r_acc and r_acc != acc_norm:
            if r_acc not in receivers_map:
                receivers_map[r_acc] = {
                    "account": r_acc,
                    "bank": tx["receiver_bank"] or "Destination Bank",
                    "amount": 0.0,
                    "count": 0,
                }
            receivers_map[r_acc]["amount"] += tx["amount"]
            receivers_map[r_acc]["count"] += 1

    # Distinct UTRs and dates for the active path
    path_tx_list = incoming_txs + outgoing_txs + withdrawal_txs + hold_txs
    distinct_utrs = set(tx["utr"] for tx in (path_tx_list if path_tx_ids is not None else all_account_txs) if tx.get("utr"))
    dates = [tx["date"] for tx in (path_tx_list if path_tx_ids is not None else all_account_txs) if tx.get("date")]
    first_date = min(dates) if dates else None
    last_date = max(dates) if dates else None

    connected_map: Dict[str, Dict[str, Any]] = {}
    for tx in incoming_txs:
        s_acc = tx["sender_account"]
        if not s_acc or s_acc == acc_norm:
            continue
        if s_acc not in connected_map:
            connected_map[s_acc] = {
                "account": s_acc,
                "masked_account": mask_account_number(s_acc),
                "bank": tx["sender_bank"] or "Source Bank",
                "role": "Sender",
                "direction": "Incoming",
                "amount": 0.0,
                "tx_count": 0,
                "layer": tx.get("layer") or "Layer 1",
            }
        connected_map[s_acc]["amount"] += tx["amount"]
        connected_map[s_acc]["tx_count"] += 1

    for tx in outgoing_txs:
        r_acc = tx["receiver_account"]
        if not r_acc or r_acc == acc_norm:
            continue
        if r_acc not in connected_map:
            connected_map[r_acc] = {
                "account": r_acc,
                "masked_account": mask_account_number(r_acc),
                "bank": tx["receiver_bank"] or "Destination Bank",
                "role": "Receiver",
                "direction": "Outgoing",
                "amount": 0.0,
                "tx_count": 0,
                "layer": tx.get("layer") or "Layer 2",
            }
        else:
            if connected_map[r_acc]["role"] == "Sender":
                connected_map[r_acc]["role"] = "Sender & Receiver"
                connected_map[r_acc]["direction"] = "Bidirectional"
        connected_map[r_acc]["amount"] += tx["amount"]
        connected_map[r_acc]["tx_count"] += 1

    for c in connected_map.values():
        c["amount"] = round(c["amount"], 2)

    connected_accounts_list = sorted(connected_map.values(), key=lambda x: -x["amount"])
    has_hold_flag = len(hold_records) > 0 or total_hold_amount > 0
    hold_status_str = "Active Hold" if has_hold_flag else "No Hold"

    if len(incoming_txs) == 0 and len(outgoing_txs) > 0:
        role_label = "Source / Origin"
    elif len(incoming_txs) > 0 and len(outgoing_txs) > 0:
        role_label = "Intermediate Sender"
    elif len(incoming_txs) > 0 and len(outgoing_txs) == 0:
        role_label = "Receiver / Beneficiary"
    elif len(withdrawal_txs) > 0 and len(outgoing_txs) == 0:
        role_label = "Withdrawal Account"
    elif has_hold_flag:
        role_label = "Hold / Lien Account"
    else:
        role_label = "Account"

    sorted_layers = sorted(list(layers_seen))
    primary_layer = sorted_layers[0] if sorted_layers else "Layer 1"
    recorded_layer_str = sorted(list(explicit_layers_seen))[0] if explicit_layers_seen else None
    net_flow_val = round(total_in_amount - total_out_amount, 2)

    unrelated_inflow = round(sum(t["amount"] for t in unrelated_incoming), 2)
    unrelated_outflow = round(sum(t["amount"] for t in unrelated_outgoing), 2)
    has_unrelated_activity = len(unrelated_money_transfers) > 0
    unrelated_source_accounts = sorted(list({t["sender_account"] for t in unrelated_incoming if t.get("sender_account")}))
    isolation_note = (
        f"Branch Isolation: ₹{unrelated_inflow:,.2f} from unrelated source(s) "
        f"({', '.join(unrelated_source_accounts) if unrelated_source_accounts else 'other branch'}) "
        f"is excluded from this active investigation path."
    ) if has_unrelated_activity else None

    # Account-wide counterparty count
    all_counterparties = set()
    for t in account_wide_money_transfers:
        s = t.get("sender_account")
        d = t.get("receiver_account")
        if s and s != acc_norm:
            all_counterparties.add(s)
        if d and d != acc_norm:
            all_counterparties.add(d)

    return {
        "account": account,
        "masked_account": mask_account_number(account),
        "bank": account_bank or "Bank / FI",
        "bank_name": account_bank or "Bank / FI",
        "ifsc": account_ifsc,
        "account_holder_name": account_holder,
        "account_role": role_label,
        "layer_recorded": recorded_layer_str or primary_layer,
        "layer_inferred": primary_layer,
        "ack_no": str(account_ack_no) if account_ack_no else None,
        # Path-specific Primary KPIs
        "total_in_amount": round(total_in_amount, 2),
        "total_out_amount": round(total_out_amount, 2),
        "inflow_amount": round(total_in_amount, 2),
        "outflow_amount": round(total_out_amount, 2),
        "net_flow": net_flow_val,
        "total_withdrawal_amount": round(total_withdrawal_amount, 2),
        "withdrawal_amount": round(total_withdrawal_amount, 2),
        "total_hold_amount": round(total_hold_amount, 2),
        "hold_amount": round(total_hold_amount, 2),
        "total_disputed_amount": round(total_disputed_amount, 2),
        "disputed_amount": round(total_disputed_amount, 2),
        "recovery_amount": round(total_hold_amount, 2),
        "incoming_count": len(incoming_txs),
        "outgoing_count": len(outgoing_txs),
        "withdrawal_count": len(withdrawal_txs),
        "hold_count": len(hold_records),
        "distinct_utr_count": len(distinct_utrs),
        "distinct_linked_accounts_count": len(connected_map),
        "first_observed_date": first_date,
        "last_observed_date": last_date,
        "has_hold": has_hold_flag,
        "hold_status": hold_status_str,
        "layers": sorted_layers,
        "senders": sorted(senders_map.values(), key=lambda x: -x["amount"]),
        "beneficiaries": sorted(receivers_map.values(), key=lambda x: -x["amount"]),
        "receivers": sorted(receivers_map.values(), key=lambda x: -x["amount"]),
        "connected_accounts": connected_accounts_list,
        "withdrawals": withdrawal_txs,
        "holds": hold_records,
        "transactions": all_account_txs,
        "all_transactions": all_account_txs,
        # Section C: 6 Categorized NCRP Worksheets Records (Path Specific for Money Transfer)
        "money_transfers": money_transfers,
        "pos_withdrawals": pos_withdrawals,
        "atm_withdrawals": atm_withdrawals,
        "cheque_withdrawals": cheque_withdrawals,
        "hold_records": hold_records,
        "other_records": other_records,
        # Path-Specific vs Account-Wide Breakdown
        "root_account": root_account,
        "is_path_isolated": bool(root_account),
        "has_unrelated_activity": has_unrelated_activity,
        "unrelated_inflow": unrelated_inflow,
        "unrelated_outflow": unrelated_outflow,
        "unrelated_tx_count": len(unrelated_money_transfers),
        "isolation_note": isolation_note,
        "account_wide_total_in": round(account_wide_total_in, 2),
        "account_wide_total_out": round(account_wide_total_out, 2),
        "account_wide_net_flow": round(account_wide_total_in - account_wide_total_out, 2),
        "account_wide_tx_count": len(account_wide_money_transfers),
        "account_wide_distinct_utr_count": len(set(tx["utr"] for tx in all_account_txs if tx.get("utr"))),
        "account_wide_connected_accounts_count": len(all_counterparties),
        "account_wide_money_transfers": account_wide_money_transfers,
        "unrelated_money_transfers": unrelated_money_transfers,
        "unrelated_source_accounts": unrelated_source_accounts,
    }


def trace_ncrp_account_forward(
    db: Session,
    file_id: int,
    account: str,
    current_layer: int,
    case_id: Optional[int] = None,
    money_transfer_only: bool = False,
) -> Dict[str, Any]:
    """Find subsequent forward layer transactions for an account."""
    acc_norm = normalize_account_identifier(account)
    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    if money_transfer_only:
        query = query.filter(NcrpTransaction.sheet_name.ilike('%money%transfer%'))
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    subsequent_layers_map: Dict[int, List[Dict[str, Any]]] = {}

    for t in all_txs:
        raw = t.raw_data or {}
        src = normalize_account_identifier(t.account_or_wallet_id)
        dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        l_str = str(t.layer or "1")
        l_num = int("".join(c for c in l_str if c.isdigit()) or 1)

        if l_num <= current_layer:
            continue

        if src == acc_norm or dest == acc_norm:
            cat = categorize_ncrp_sheet(t.sheet_name)
            tx_item = {
                "id": t.id,
                "row_number": t.row_number,
                "sheet_name": t.sheet_name,
                "category": cat,
                "layer": f"Layer {l_num}",
                "layer_num": l_num,
                "amount": float(t.transaction_amount or 0.0),
                "disputed_amount": float(t.disputed_amount or 0.0),
                "utr": t.transaction_id_utr or raw.get("Transaction Id / UTR Number") or raw.get("source_utr"),
                "date": str(t.transaction_date).split("T")[0] if t.transaction_date else None,
                "sender_account": src,
                "sender_bank": raw.get("Action Taken By bank") or raw.get("action_taken_by_bank") or t.bank_name,
                "receiver_account": dest,
                "receiver_bank": t.bank_name or raw.get("Bank/FIs"),
                "role": "Sender / Origin" if src == acc_norm else "Receiver / Beneficiary",
                "remarks": raw.get("Remarks"),
                "atm_id": raw.get("ATM ID") or raw.get("Place/Location of ATM"),
                "merchant_name": raw.get("Merchant Name") or raw.get("MID"),
                "cheque_no": raw.get("Cheque No"),
                "hold_amount": float(raw.get("Put on Hold Amount") or raw.get("Put on hold Amount") or t.transaction_amount or 0.0) if cat == "Hold Action" else 0.0,
            }
            if l_num not in subsequent_layers_map:
                subsequent_layers_map[l_num] = []
            subsequent_layers_map[l_num].append(tx_item)

    if not subsequent_layers_map:
        return {
            "account": account,
            "current_layer": current_layer,
            "has_next_activity": False,
            "next_layer": None,
            "next_layer_str": None,
            "subsequent_layers_available": [],
            "next_transfers": 0,
            "next_withdrawals": 0,
            "next_holds": 0,
            "next_total_amount": 0.0,
            "message": f"No forward transactions found in layers after Layer {current_layer}.",
            "summary": {},
            "next_layer_transactions": [],
        }

    earliest_layer = min(subsequent_layers_map.keys())
    next_txs = subsequent_layers_map[earliest_layer]
    transfer_count = sum(1 for tx in next_txs if tx["category"] == "Money Transfer")
    withdrawal_count = sum(1 for tx in next_txs if tx["category"] in ["ATM Withdrawal", "POS Withdrawal", "Cheque Withdrawal"])
    hold_count = sum(1 for tx in next_txs if tx["category"] == "Hold Action")
    total_val = sum(tx["amount"] for tx in next_txs)

    return {
        "account": account,
        "current_layer": current_layer,
        "has_next_activity": True,
        "next_layer": earliest_layer,
        "next_layer_str": f"Layer {earliest_layer}",
        "subsequent_layers_available": sorted(list(subsequent_layers_map.keys())),
        "next_transfers": transfer_count,
        "next_withdrawals": withdrawal_count,
        "next_holds": hold_count,
        "next_total_amount": round(total_val, 2),
        "message": f"Found {len(next_txs)} activity records in Layer {earliest_layer}.",
        "summary": {
            "total_transactions": len(next_txs),
            "transfer_count": transfer_count,
            "withdrawal_count": withdrawal_count,
            "hold_count": hold_count,
            "total_amount": round(total_val, 2),
        },
        "next_layer_transactions": next_txs,
    }


def get_ncrp_layer1_sources(
    db: Session,
    file_id: int,
    case_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Retrieve all distinct Layer 1 source accounts from Money Transfer To worksheet with outgoing KPIs."""
    query = db.query(NcrpTransaction).filter(
        NcrpTransaction.ncrp_file_id == file_id,
        NcrpTransaction.sheet_name.ilike('%money%transfer%')
    )
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    if not all_txs:
        return {
            "file_id": file_id,
            "case_id": case_id or 0,
            "total_sources": 0,
            "sources": [],
        }

    # Identify transactions recorded in Layer 1
    l1_txs = []
    for t in all_txs:
        l_str = str(t.layer or "1")
        l_num = int("".join(c for c in l_str if c.isdigit()) or 1)
        if l_num == 1:
            l1_txs.append(t)

    # Fallback to earliest layer if no explicit Layer 1 rows
    if not l1_txs:
        earliest_l = min(
            (int("".join(c for c in str(t.layer or "1") if c.isdigit()) or 1) for t in all_txs),
            default=1,
        )
        for t in all_txs:
            l_str = str(t.layer or "1")
            l_num = int("".join(c for c in l_str if c.isdigit()) or 1)
            if l_num == earliest_l:
                l1_txs.append(t)

    sources_map: Dict[str, Dict[str, Any]] = {}
    for t in l1_txs:
        raw = t.raw_data or {}
        raw_src = (
            t.account_or_wallet_id
            or raw.get("Account No./ (Wallet /PG/PA) Id")
            or raw.get("account_or_wallet_id")
            or ""
        )
        norm_src = normalize_account_identifier(raw_src)
        if not norm_src:
            continue

        dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        amt = float(t.transaction_amount or 0.0)
        disp = float(t.disputed_amount or 0.0)
        bank = (
            raw.get("Action Taken By bank")
            or raw.get("action_taken_by_bank")
            or t.bank_name
            or raw.get("Bank/FIs")
            or "Unknown Bank"
        )
        ack = t.acknowledgement_no or raw.get("Acknowledgement No")
        dt = str(t.transaction_date).split("T")[0] if t.transaction_date else None

        if norm_src not in sources_map:
            sources_map[norm_src] = {
                "account": norm_src,
                "raw_account": str(raw_src).strip(),
                "masked_account": mask_account_number(norm_src),
                "bank": bank,
                "action_taken_by_bank": raw.get("Action Taken By bank"),
                "ack_no": str(ack) if ack else None,
                "total_outgoing_amount": 0.0,
                "total_disputed_amount": 0.0,
                "outgoing_tx_count": 0,
                "distinct_receivers_count": 0,
                "distinct_utrs_count": 0,
                "first_date": None,
                "last_date": None,
                "receivers_set": set(),
                "utrs_set": set(),
                "receivers": [],
                "total_transfers": 0,
                "total_amount": 0.0,
            }

        s = sources_map[norm_src]
        s["outgoing_tx_count"] += 1
        s["total_transfers"] += 1
        s["total_outgoing_amount"] += amt
        s["total_amount"] += amt
        s["total_disputed_amount"] += disp
        if (not s["bank"] or s["bank"] == "Unknown Bank") and bank:
            s["bank"] = bank
        if not s["ack_no"] and ack:
            s["ack_no"] = str(ack)
        if dt:
            if not s["first_date"] or dt < s["first_date"]:
                s["first_date"] = dt
            if not s["last_date"] or dt > s["last_date"]:
                s["last_date"] = dt
        if t.transaction_id_utr:
            s["utrs_set"].add(t.transaction_id_utr)
        if dest:
            s["receivers_set"].add(dest)
            s["receivers"].append({
                "account": dest,
                "masked_account": mask_account_number(dest),
                "bank": t.bank_name or raw.get("Bank/FIs"),
                "amount": round(amt, 2),
                "utr": t.transaction_id_utr,
                "date": dt,
                "sheet_name": t.sheet_name,
                "row_number": t.row_number,
            })

    for s in sources_map.values():
        s["distinct_receivers_count"] = len(s.pop("receivers_set"))
        s["distinct_utrs_count"] = len(s.pop("utrs_set"))
        s["total_outgoing_amount"] = round(s["total_outgoing_amount"], 2)
        s["total_amount"] = round(s["total_amount"], 2)
        s["total_disputed_amount"] = round(s["total_disputed_amount"], 2)

    sources_list = list(sources_map.values())
    sources_list.sort(
        key=lambda x: (
            -(x["distinct_receivers_count"] > 0),
            -x["total_outgoing_amount"],
            -x["outgoing_tx_count"],
        )
    )

    return {
        "file_id": file_id,
        "case_id": case_id or 0,
        "total_sources": len(sources_list),
        "sources": sources_list,
    }


def get_ncrp_hierarchical_graph_data(
    db: Session,
    file_id: int,
    case_id: Optional[int] = None,
    root_account: Optional[str] = None,
    expand_account: Optional[str] = None,
    expand_all: bool = False,
    expanded_accounts: Optional[List[str]] = None,
    search: Optional[str] = None,
    bank_name: Optional[str] = None,
    layer: Optional[int] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve hierarchical DAG graph data for NCRP layer-wise money flow analysis."""
    file_obj = db.query(NcrpFile).filter(NcrpFile.id == file_id).first()
    filename = file_obj.original_filename if file_obj else f"File #{file_id}"

    query = db.query(NcrpTransaction).filter(
        NcrpTransaction.ncrp_file_id == file_id,
        NcrpTransaction.sheet_name.ilike('%money%transfer%')
    )
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    if not all_txs:
        return {
            "file_id": file_id,
            "case_id": case_id or 0,
            "filename": filename,
            "root_accounts": [],
            "selected_root": None,
            "nodes": [],
            "edges": [],
            "available_layers": [],
            "available_banks": [],
            "available_acknowledgements": [],
            "max_layer": 1,
            "total_amount": 0.0,
            "total_disputed_amount": 0.0,
            "total_transactions": 0,
            "distinct_accounts_count": 0,
            "has_outgoing": False,
            "message": "No transaction records found in this workbook.",
        }

    # 1. First pass: Aggregate overall workbook KPIs and account metadata
    all_distinct_accounts = set()
    available_layers_set = set()
    available_banks_set = set()
    available_acks_set = set()
    total_tx_volume = 0.0
    total_disputed_volume = 0.0

    acc_metadata: Dict[str, Dict[str, Any]] = {}

    def get_or_create_acc_meta(acc_num: str) -> Dict[str, Any]:
        if acc_num not in acc_metadata:
            acc_metadata[acc_num] = {
                "account": acc_num,
                "masked_account": mask_account_number(acc_num),
                "bank": None,
                "holder_name": None,
                "ifsc": None,
                "ack_no": None,
                "hold_amount": 0.0,
                "has_hold": False,
                "disputed_amount": 0.0,
                "total_in": 0.0,
                "total_out": 0.0,
                "tx_count": 0,
                "layer_recorded": None,
                "layer_inferred": None,
            }
        return acc_metadata[acc_num]

    # Candidate root discovery tracking
    layer1_senders: Counter = Counter()
    layer1_receivers: set = set()
    all_senders: Counter = Counter()
    all_receivers: set = set()

    # Group money transfer edges
    outgoing_transfers: Dict[str, List[Dict[str, Any]]] = {}

    for t in all_txs:
        raw = t.raw_data or {}
        src = normalize_account_identifier(t.account_or_wallet_id)
        dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        cat = categorize_ncrp_sheet(t.sheet_name)
        amt = float(t.transaction_amount or 0.0)
        disp = float(t.disputed_amount or 0.0)
        l_str = str(t.layer or "1")
        l_num = int("".join(c for c in l_str if c.isdigit()) or 1)

        available_layers_set.add(l_num)
        if t.bank_name:
            available_banks_set.add(t.bank_name)
        if raw.get("Bank/FIs"):
            available_banks_set.add(raw.get("Bank/FIs"))
        if raw.get("Action Taken By bank"):
            available_banks_set.add(raw.get("Action Taken By bank"))
        if t.acknowledgement_no:
            available_acks_set.add(str(t.acknowledgement_no))

        total_disputed_volume += disp

        if src:
            all_distinct_accounts.add(src)
            s_meta = get_or_create_acc_meta(src)
            s_meta["tx_count"] += 1
            s_meta["disputed_amount"] += disp
            if t.layer and str(t.layer).strip() and not s_meta.get("layer_recorded"):
                s_meta["layer_recorded"] = f"Layer {l_num}"
            if not s_meta["bank"]:
                s_meta["bank"] = (
                    raw.get("Action Taken By bank")
                    or raw.get("action_taken_by_bank")
                    or t.bank_name
                )
            if not s_meta["ifsc"]:
                s_meta["ifsc"] = raw.get("IFSC") or raw.get("ifsc") or raw.get("IFSC Code")
            if not s_meta["holder_name"]:
                s_meta["holder_name"] = (
                    raw.get("Account Holder Name")
                    or raw.get("Account Name")
                    or raw.get("Customer Name")
                    or raw.get("Name of Acc Holder")
                )
            if not s_meta["ack_no"]:
                s_meta["ack_no"] = t.acknowledgement_no or raw.get("Acknowledgement No")

        if dest:
            all_distinct_accounts.add(dest)
            d_meta = get_or_create_acc_meta(dest)
            d_meta["tx_count"] += 1
            d_meta["disputed_amount"] += disp
            if t.layer and str(t.layer).strip() and not d_meta.get("layer_recorded"):
                d_meta["layer_recorded"] = f"Layer {l_num}"
            if not d_meta["bank"]:
                d_meta["bank"] = t.bank_name or raw.get("Bank/FIs")
            if not d_meta["ifsc"]:
                d_meta["ifsc"] = raw.get("IFSC") or raw.get("ifsc") or raw.get("IFSC Code")
            if not d_meta["holder_name"]:
                d_meta["holder_name"] = (
                    raw.get("Account Holder Name")
                    or raw.get("Account Name")
                    or raw.get("Customer Name")
                    or raw.get("Name of Acc Holder")
                )
            if not d_meta["ack_no"]:
                d_meta["ack_no"] = t.acknowledgement_no or raw.get("Acknowledgement No")

        if cat == "Hold Action":
            h_val = float(raw.get("Put on Hold Amount") or raw.get("Put on hold Amount") or amt)
            target_acc = dest or src
            if target_acc:
                t_meta = get_or_create_acc_meta(target_acc)
                t_meta["has_hold"] = True
                t_meta["hold_amount"] += h_val

        if cat == "Money Transfer":
            total_tx_volume += amt
            if src:
                all_senders[src] += amt
                s_meta = get_or_create_acc_meta(src)
                s_meta["total_out"] += amt
                if l_num == 1:
                    layer1_senders[src] += amt
            if dest:
                all_receivers.add(dest)
                d_meta = get_or_create_acc_meta(dest)
                d_meta["total_in"] += amt
                if l_num == 1:
                    layer1_receivers.add(dest)

            if src and dest:
                if src not in outgoing_transfers:
                    outgoing_transfers[src] = []
                outgoing_transfers[src].append({
                    "src": src,
                    "dest": dest,
                    "src_bank": raw.get("Action Taken By bank") or t.bank_name,
                    "dest_bank": t.bank_name or raw.get("Bank/FIs"),
                    "amount": amt,
                    "disputed_amount": disp,
                    "layer_num": l_num,
                    "layer": f"Layer {l_num}",
                    "utr": t.transaction_id_utr or raw.get("Transaction Id / UTR Number") or raw.get("source_utr"),
                    "date": str(t.transaction_date).split("T")[0] if t.transaction_date else None,
                    "sheet_name": t.sheet_name,
                    "row_number": t.row_number,
                    "ack_no": t.acknowledgement_no,
                    "tx_id": t.id,
                })

    # 2. Identify candidate root / suspect accounts from Layer 1 sources
    l1_sources_data = get_ncrp_layer1_sources(db=db, file_id=file_id, case_id=case_id)
    root_accounts_list = l1_sources_data.get("sources", [])

    if not root_accounts_list:
        candidate_keys = [s for s in layer1_senders.keys() if s not in layer1_receivers]
        if not candidate_keys:
            candidate_keys = [s for s in all_senders.keys() if s not in all_receivers]
        if not candidate_keys:
            candidate_keys = [s for s, _ in all_senders.most_common()]
        if not candidate_keys and all_distinct_accounts:
            candidate_keys = list(all_distinct_accounts)

        for r_acc in candidate_keys:
            r_meta = acc_metadata.get(r_acc, {})
            root_accounts_list.append({
                "account": r_acc,
                "raw_account": r_acc,
                "masked_account": mask_account_number(r_acc),
                "bank": r_meta.get("bank") or "Primary Bank",
                "action_taken_by_bank": r_meta.get("bank"),
                "ack_no": r_meta.get("ack_no"),
                "total_outgoing_amount": round(all_senders.get(r_acc, 0.0), 2),
                "total_disputed_amount": round(r_meta.get("disputed_amount", 0.0), 2),
                "outgoing_tx_count": len(outgoing_transfers.get(r_acc, [])),
                "distinct_receivers_count": len({tx["dest"] for tx in outgoing_transfers.get(r_acc, []) if tx.get("dest")}),
                "distinct_utrs_count": len({tx["utr"] for tx in outgoing_transfers.get(r_acc, []) if tx.get("utr")}),
                "total_transfers": len(outgoing_transfers.get(r_acc, [])),
                "total_amount": round(all_senders.get(r_acc, 0.0), 2),
                "receivers": [],
            })

    chosen_root = None
    if root_account:
        norm_req_root = normalize_account_identifier(root_account)
        if norm_req_root in acc_metadata or any(r["account"] == norm_req_root for r in root_accounts_list):
            chosen_root = norm_req_root

    # If only 1 root exists and no root specified, auto-select it
    if not chosen_root and len(root_accounts_list) == 1:
        chosen_root = root_accounts_list[0]["account"]

    # If no root chosen yet (multiple starting sources available and user has not picked one):
    if not chosen_root:
        return {
            "file_id": file_id,
            "case_id": case_id or 0,
            "filename": filename,
            "root_accounts": root_accounts_list,
            "selected_root": None,
            "nodes": [],
            "edges": [],
            "available_layers": sorted(list(available_layers_set)),
            "available_banks": sorted(list(available_banks_set)),
            "available_acknowledgements": sorted(list(available_acks_set)),
            "max_layer": 1,
            "total_amount": round(total_tx_volume, 2),
            "total_disputed_amount": round(total_disputed_volume, 2),
            "total_transactions": len(all_txs),
            "distinct_accounts_count": len(all_distinct_accounts),
            "has_outgoing": True,
            "message": "Please select a Layer 1 starting account to begin investigation.",
        }

    # 3. Setup expansion set
    expanded_set = set()
    if chosen_root:
        expanded_set.add(chosen_root)

    # Path-specific transactions and account flows for the chosen root
    path_tx_ids = None
    path_in_by_acc: Counter = Counter()
    path_out_by_acc: Counter = Counter()
    if chosen_root:
        all_mt_txs = [t for t in all_txs if categorize_ncrp_sheet(t.sheet_name) == "Money Transfer"]
        path_tx_ids, _, _ = get_ncrp_path_transactions(all_mt_txs, chosen_root)
        for t in all_mt_txs:
            if t.id in path_tx_ids:
                raw_t = t.raw_data or {}
                s_acc = normalize_account_identifier(t.account_or_wallet_id)
                d_acc = normalize_account_identifier(raw_t.get("Account No") or raw_t.get("account_no"))
                amt_t = float(t.transaction_amount or 0.0)
                if s_acc:
                    path_out_by_acc[s_acc] += amt_t
                if d_acc:
                    path_in_by_acc[d_acc] += amt_t

    if expand_all:
        for acc in outgoing_transfers.keys():
            expanded_set.add(acc)
    else:
        if expanded_accounts:
            for acc in expanded_accounts:
                expanded_set.add(normalize_account_identifier(acc))
        if expand_account:
            expanded_set.add(normalize_account_identifier(expand_account))

    terminal_message = None
    has_outgoing_flag = True
    if expand_account:
        norm_exp = normalize_account_identifier(expand_account)
        exp_out = [
            tx for tx in outgoing_transfers.get(norm_exp, [])
            if path_tx_ids is None or tx.get("tx_id") in path_tx_ids
        ]
        if not exp_out:
            has_outgoing_flag = False
            terminal_message = "No further linked transactions available for this account."

    # 4. BFS Traversal starting from chosen_root
    nodes_map: Dict[str, Dict[str, Any]] = {}
    edges_map: Dict[str, Dict[str, Any]] = {}

    if chosen_root:
        queue = deque([(chosen_root, 1)])
        visited_nodes = {chosen_root: 1}

        while queue:
            curr_acc, curr_layer = queue.popleft()

            curr_meta = acc_metadata.get(curr_acc, {})
            raw_out_txs = outgoing_transfers.get(curr_acc, [])
            out_txs = [
                tx for tx in raw_out_txs
                if path_tx_ids is None or tx.get("tx_id") in path_tx_ids
            ]
            has_forward = len(out_txs) > 0

            node_in = path_in_by_acc.get(curr_acc, 0.0) if path_tx_ids is not None else curr_meta.get("total_in", 0.0)
            node_out = path_out_by_acc.get(curr_acc, 0.0) if path_tx_ids is not None else curr_meta.get("total_out", 0.0)
            acc_wide_in = curr_meta.get("total_in", 0.0)
            acc_wide_out = curr_meta.get("total_out", 0.0)
            has_unrelated = (acc_wide_in > node_in + 0.01) or (acc_wide_out > node_out + 0.01)

            if curr_acc not in nodes_map:
                if curr_acc == chosen_root:
                    role_str = "Source / Origin"
                elif has_forward and node_in > 0:
                    role_str = "Intermediate Sender"
                elif has_forward:
                    role_str = "Sender"
                elif curr_meta.get("has_hold"):
                    role_str = "Hold / Lien Account"
                else:
                    role_str = "Receiver / Beneficiary"

                nodes_map[curr_acc] = {
                    "id": f"node-{curr_acc}",
                    "account": curr_acc,
                    "masked_account": mask_account_number(curr_acc),
                    "bank": curr_meta.get("bank") or "Bank / FI",
                    "layer": f"Layer {curr_layer}",
                    "layer_num": curr_layer,
                    "layer_recorded": curr_meta.get("layer_recorded"),
                    "layer_inferred": f"Layer {curr_layer}",
                    "role": role_str,
                    "is_source": (curr_acc == chosen_root),
                    "has_outgoing": has_forward,
                    "is_expanded": (curr_acc in expanded_set),
                    "hold_amount": round(curr_meta.get("hold_amount", 0.0), 2),
                    "has_hold": curr_meta.get("has_hold", False),
                    "disputed_amount": round(curr_meta.get("disputed_amount", 0.0), 2),
                    "total_in": round(node_in, 2),
                    "total_out": round(node_out, 2),
                    "account_wide_total_in": round(acc_wide_in, 2),
                    "account_wide_total_out": round(acc_wide_out, 2),
                    "has_unrelated_activity": has_unrelated,
                    "tx_count": curr_meta.get("tx_count", 0),
                    "ack_no": str(curr_meta.get("ack_no")) if curr_meta.get("ack_no") else None,
                    "ifsc": curr_meta.get("ifsc"),
                    "account_holder": curr_meta.get("holder_name"),
                }
            else:
                nodes_map[curr_acc]["is_expanded"] = (curr_acc in expanded_set)

            if curr_acc in expanded_set:
                for tx in out_txs:
                    dest_acc = tx["dest"]
                    if not dest_acc or dest_acc == curr_acc:
                        continue

                    if min_amount is not None and tx["amount"] < min_amount:
                        continue
                    if max_amount is not None and tx["amount"] > max_amount:
                        continue

                    edge_key = f"{curr_acc}->{dest_acc}@{curr_layer}"
                    if edge_key not in edges_map:
                        edges_map[edge_key] = {
                            "id": f"edge-{curr_acc}-{dest_acc}-{curr_layer}",
                            "source": f"node-{curr_acc}",
                            "target": f"node-{dest_acc}",
                            "source_acc": curr_acc,
                            "target_acc": dest_acc,
                            "source_bank": curr_meta.get("bank") or tx["src_bank"] or "Source Bank",
                            "target_bank": acc_metadata.get(dest_acc, {}).get("bank") or tx["dest_bank"] or "Destination Bank",
                            "amount": 0.0,
                            "disputed_amount": 0.0,
                            "layer": f"Layer {curr_layer}",
                            "layer_num": curr_layer,
                            "tx_count": 0,
                            "utr": tx["utr"],
                            "date": tx["date"],
                            "sheet_name": tx["sheet_name"],
                            "row_numbers": [],
                            "transactions": [],
                        }

                    edges_map[edge_key]["amount"] += tx["amount"]
                    edges_map[edge_key]["disputed_amount"] += tx["disputed_amount"]
                    edges_map[edge_key]["tx_count"] += 1
                    edges_map[edge_key]["row_numbers"].append(tx["row_number"])
                    edges_map[edge_key]["transactions"].append(tx)

                    next_layer = curr_layer + 1
                    dest_meta = acc_metadata.get(dest_acc, {})
                    dest_raw_out = outgoing_transfers.get(dest_acc, [])
                    dest_out = [
                        tx for tx in dest_raw_out
                        if path_tx_ids is None or tx.get("tx_id") in path_tx_ids
                    ]
                    dest_has_forward = len(dest_out) > 0

                    dest_in = path_in_by_acc.get(dest_acc, 0.0) if path_tx_ids is not None else dest_meta.get("total_in", 0.0)
                    dest_out_amt = path_out_by_acc.get(dest_acc, 0.0) if path_tx_ids is not None else dest_meta.get("total_out", 0.0)
                    dest_acc_wide_in = dest_meta.get("total_in", 0.0)
                    dest_acc_wide_out = dest_meta.get("total_out", 0.0)
                    dest_has_unrelated = (dest_acc_wide_in > dest_in + 0.01) or (dest_acc_wide_out > dest_out_amt + 0.01)

                    if dest_acc not in nodes_map:
                        dest_role = (
                            "Intermediate Sender" if (dest_has_forward and dest_in > 0)
                            else "Sender" if dest_has_forward
                            else "Hold / Lien Account" if dest_meta.get("has_hold")
                            else "Receiver / Beneficiary"
                        )
                        nodes_map[dest_acc] = {
                            "id": f"node-{dest_acc}",
                            "account": dest_acc,
                            "masked_account": mask_account_number(dest_acc),
                            "bank": dest_meta.get("bank") or tx["dest_bank"] or "Bank / FI",
                            "layer": f"Layer {next_layer}",
                            "layer_num": next_layer,
                            "layer_recorded": dest_meta.get("layer_recorded") or (f"Layer {tx['layer_num']}" if tx.get("layer_num") else None),
                            "layer_inferred": f"Layer {next_layer}",
                            "role": dest_role,
                            "is_source": False,
                            "has_outgoing": dest_has_forward,
                            "is_expanded": (dest_acc in expanded_set),
                            "hold_amount": round(dest_meta.get("hold_amount", 0.0), 2),
                            "has_hold": dest_meta.get("has_hold", False),
                            "disputed_amount": round(dest_meta.get("disputed_amount", 0.0), 2),
                            "total_in": round(dest_in, 2),
                            "total_out": round(dest_out_amt, 2),
                            "account_wide_total_in": round(dest_acc_wide_in, 2),
                            "account_wide_total_out": round(dest_acc_wide_out, 2),
                            "has_unrelated_activity": dest_has_unrelated,
                            "tx_count": dest_meta.get("tx_count", 0),
                            "ack_no": str(dest_meta.get("ack_no")) if dest_meta.get("ack_no") else None,
                            "ifsc": dest_meta.get("ifsc"),
                            "account_holder": dest_meta.get("holder_name"),
                        }

                    if dest_acc not in visited_nodes:
                        visited_nodes[dest_acc] = next_layer
                        queue.append((dest_acc, next_layer))

    for e in edges_map.values():
        e["amount"] = round(e["amount"], 2)
        e["disputed_amount"] = round(e["disputed_amount"], 2)

    node_list = list(nodes_map.values())
    edge_list = list(edges_map.values())
    max_observed_layer = max([n["layer_num"] for n in node_list], default=1)

    return {
        "file_id": file_id,
        "case_id": case_id or 0,
        "filename": filename,
        "root_accounts": root_accounts_list,
        "selected_root": chosen_root,
        "nodes": node_list,
        "edges": edge_list,
        "available_layers": sorted(list(available_layers_set)),
        "available_banks": sorted(list(available_banks_set)),
        "available_acknowledgements": sorted(list(available_acks_set)),
        "max_layer": max_observed_layer,
        "total_amount": round(total_tx_volume, 2),
        "total_disputed_amount": round(total_disputed_volume, 2),
        "total_transactions": len(all_txs),
        "distinct_accounts_count": len(all_distinct_accounts),
        "has_outgoing": has_outgoing_flag,
        "message": terminal_message,
    }


def get_ncrp_edge_transactions(
    db: Session,
    file_id: int,
    source_account: str,
    target_account: str,
    layer: Optional[int] = None,
    case_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Retrieve individual original Money Transfer To transaction records belonging to an aggregated edge."""
    src_norm = normalize_account_identifier(source_account)
    dest_norm = normalize_account_identifier(target_account)

    query = db.query(NcrpTransaction).filter(
        NcrpTransaction.ncrp_file_id == file_id,
        NcrpTransaction.sheet_name.ilike('%money%transfer%')
    )
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    matched_txs = []
    total_amt = 0.0
    total_disp = 0.0

    for t in all_txs:
        raw = t.raw_data or {}
        src = normalize_account_identifier(t.account_or_wallet_id)
        dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        l_str = str(t.layer or "1")
        l_num = int("".join(c for c in l_str if c.isdigit()) or 1)

        if layer is not None and l_num != layer:
            continue

        if src == src_norm and dest == dest_norm:
            amt = float(t.transaction_amount or 0.0)
            disp = float(t.disputed_amount or 0.0)
            total_amt += amt
            total_disp += disp

            matched_txs.append({
                "id": t.id,
                "row_number": t.row_number,
                "sheet_name": t.sheet_name,
                "acknowledgement_no": t.acknowledgement_no or raw.get("Acknowledgement No") or raw.get("Acknowledgement No."),
                "source_account": src,
                "source_bank": raw.get("Action Taken By bank") or raw.get("action_taken_by_bank") or t.bank_name or "Source Bank",
                "receiver_account": dest,
                "receiver_bank": t.bank_name or raw.get("Bank/FIs") or "Destination Bank",
                "receiver_ifsc": raw.get("Ifsc Code") or raw.get("IFSC Code") or raw.get("IFSC") or raw.get("ifsc"),
                "transaction_amount": amt,
                "disputed_amount": disp,
                "layer": f"Layer {l_num}",
                "layer_num": l_num,
                "utr": t.transaction_id_utr or raw.get("Transaction ID / UTR Number") or raw.get("Transaction Id / UTR Number") or raw.get("source_utr"),
                "date": str(t.transaction_date).split("T")[0] if t.transaction_date else None,
                "raw_data": raw,
            })

    return {
        "file_id": file_id,
        "case_id": case_id or 0,
        "source_account": source_account,
        "target_account": target_account,
        "layer": layer,
        "total_amount": round(total_amt, 2),
        "total_disputed_amount": round(total_disp, 2),
        "transaction_count": len(matched_txs),
        "transactions": matched_txs,
    }


def get_ncrp_sender_receivers(
    db: Session,
    file_id: int,
    sender_account: str,
    layer: Optional[int] = None,
    case_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Retrieve all distinct receivers and aggregated transfers for a sender from Money Transfer To worksheet."""
    src_norm = normalize_account_identifier(sender_account)

    query = db.query(NcrpTransaction).filter(
        NcrpTransaction.ncrp_file_id == file_id,
        NcrpTransaction.sheet_name.ilike('%money%transfer%')
    )
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    receivers_map: Dict[str, Dict[str, Any]] = {}
    total_outflow = 0.0

    for t in all_txs:
        raw = t.raw_data or {}
        src = normalize_account_identifier(t.account_or_wallet_id)
        dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        l_str = str(t.layer or "1")
        l_num = int("".join(c for c in l_str if c.isdigit()) or 1)

        if layer is not None and l_num != layer:
            continue

        if src == src_norm and dest:
            amt = float(t.transaction_amount or 0.0)
            disp = float(t.disputed_amount or 0.0)
            total_outflow += amt

            if dest not in receivers_map:
                receivers_map[dest] = {
                    "account": dest,
                    "masked_account": mask_account_number(dest),
                    "bank": t.bank_name or raw.get("Bank/FIs") or "Destination Bank",
                    "ifsc": raw.get("Ifsc Code") or raw.get("IFSC Code") or raw.get("IFSC") or raw.get("ifsc"),
                    "layer": f"Layer {l_num}",
                    "layer_num": l_num,
                    "total_amount": 0.0,
                    "disputed_amount": 0.0,
                    "transaction_count": 0,
                    "transactions": [],
                }

            r = receivers_map[dest]
            r["total_amount"] += amt
            r["disputed_amount"] += disp
            r["transaction_count"] += 1
            r["transactions"].append({
                "id": t.id,
                "row_number": t.row_number,
                "utr": t.transaction_id_utr or raw.get("Transaction ID / UTR Number") or raw.get("Transaction Id / UTR Number") or raw.get("source_utr"),
                "date": str(t.transaction_date).split("T")[0] if t.transaction_date else None,
                "amount": amt,
                "disputed_amount": disp,
            })

    for r in receivers_map.values():
        r["total_amount"] = round(r["total_amount"], 2)
        r["disputed_amount"] = round(r["disputed_amount"], 2)

    receivers_list = sorted(receivers_map.values(), key=lambda x: -x["total_amount"])

    return {
        "file_id": file_id,
        "case_id": case_id or 0,
        "sender_account": sender_account,
        "layer": layer,
        "total_receivers": len(receivers_list),
        "total_outflow": round(total_outflow, 2),
        "receivers": receivers_list,
    }


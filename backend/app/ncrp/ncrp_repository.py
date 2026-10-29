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


def get_ncrp_account_profile_data(
    db: Session,
    file_id: int,
    account: str,
    case_id: Optional[int] = None,
    layer: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve complete 360-degree account profile across all NCRP worksheets."""
    acc_norm = normalize_account_identifier(account)
    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
    all_txs = query.order_by(NcrpTransaction.row_number.asc()).all()

    account_bank = None
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

    for t in all_txs:
        raw = t.raw_data or {}
        src = normalize_account_identifier(t.account_or_wallet_id)
        dest = normalize_account_identifier(raw.get("Account No") or raw.get("account_no"))
        cat = categorize_ncrp_sheet(t.sheet_name)
        amt = float(t.transaction_amount or 0.0)
        disp = float(t.disputed_amount or 0.0)
        l_str = str(t.layer or "1")
        l_num = int("".join(c for c in l_str if c.isdigit()) or 1)
        layer_label = f"Layer {l_num}"

        is_sender = (src == acc_norm)
        is_receiver = (dest == acc_norm)

        if not is_sender and not is_receiver:
            continue

        layers_seen.add(layer_label)
        if not account_bank:
            if is_sender:
                account_bank = (
                    raw.get("Action Taken By bank")
                    or raw.get("action_taken_by_bank")
                    or t.bank_name
                )
            elif is_receiver:
                account_bank = t.bank_name or raw.get("Bank/FIs")

        tx_summary = {
            "id": t.id,
            "row_number": t.row_number,
            "sheet_name": t.sheet_name,
            "category": cat,
            "layer": layer_label,
            "layer_num": l_num,
            "date": str(t.transaction_date).split("T")[0] if t.transaction_date else None,
            "amount": amt,
            "disputed_amount": disp,
            "utr": t.transaction_id_utr or raw.get("Transaction Id / UTR Number") or raw.get("source_utr"),
            "ack_no": t.acknowledgement_no,
            "sender_account": src,
            "sender_bank": raw.get("Action Taken By bank") or raw.get("action_taken_by_bank") or t.bank_name,
            "receiver_account": dest,
            "receiver_bank": t.bank_name or raw.get("Bank/FIs"),
            "remarks": raw.get("Remarks"),
            "atm_id": raw.get("ATM ID") or raw.get("Place/Location of ATM"),
            "merchant_name": raw.get("Merchant Name") or raw.get("MID"),
            "cheque_no": raw.get("Cheque No"),
            "branch_location": raw.get("Branch Location"),
            "hold_amount": float(raw.get("Put on Hold Amount") or raw.get("Put on hold Amount") or amt) if cat == "Hold Action" else 0.0,
            "action_date": raw.get("Date of Action") or raw.get("Put on hold Date"),
        }
        all_account_txs.append(tx_summary)

        if cat == "Money Transfer":
            if is_receiver:
                total_in_amount += amt
                total_disputed_amount += disp
                incoming_txs.append(tx_summary)
            if is_sender:
                total_out_amount += amt
                total_disputed_amount += disp
                outgoing_txs.append(tx_summary)
        elif cat in ["ATM Withdrawal", "POS Withdrawal", "Cheque Withdrawal"]:
            total_withdrawal_amount += amt
            total_disputed_amount += disp
            withdrawal_txs.append(tx_summary)
        elif cat == "Hold Action":
            h_val = tx_summary["hold_amount"]
            total_hold_amount += h_val
            total_disputed_amount += disp
            hold_txs.append(tx_summary)
        else:
            total_out_amount += amt
            total_disputed_amount += disp

    # Group connected counterparties
    senders_map: Dict[str, Dict[str, Any]] = {}
    for tx in incoming_txs:
        s_acc = tx["sender_account"]
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
        if r_acc not in receivers_map:
            receivers_map[r_acc] = {
                "account": r_acc,
                "bank": tx["receiver_bank"] or "Destination Bank",
                "amount": 0.0,
                "count": 0,
            }
        receivers_map[r_acc]["amount"] += tx["amount"]
        receivers_map[r_acc]["count"] += 1

    return {
        "account": account,
        "bank": account_bank or "Bank / FI",
        "bank_name": account_bank or "Bank / FI",
        "total_in_amount": round(total_in_amount, 2),
        "total_out_amount": round(total_out_amount, 2),
        "inflow_amount": round(total_in_amount, 2),
        "outflow_amount": round(total_out_amount, 2),
        "total_withdrawal_amount": round(total_withdrawal_amount, 2),
        "withdrawal_amount": round(total_withdrawal_amount, 2),
        "total_hold_amount": round(total_hold_amount, 2),
        "hold_amount": round(total_hold_amount, 2),
        "total_disputed_amount": round(total_disputed_amount, 2),
        "disputed_amount": round(total_disputed_amount, 2),
        "incoming_count": len(incoming_txs),
        "outgoing_count": len(outgoing_txs),
        "withdrawal_count": len(withdrawal_txs),
        "hold_count": len(hold_txs),
        "layers": sorted(list(layers_seen)),
        "senders": sorted(senders_map.values(), key=lambda x: -x["amount"]),
        "beneficiaries": sorted(receivers_map.values(), key=lambda x: -x["amount"]),
        "receivers": sorted(receivers_map.values(), key=lambda x: -x["amount"]),
        "withdrawals": withdrawal_txs,
        "holds": hold_txs,
        "transactions": all_account_txs,
        "all_transactions": all_account_txs,
    }


def trace_ncrp_account_forward(
    db: Session,
    file_id: int,
    account: str,
    current_layer: int,
    case_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Find subsequent forward layer transactions (transfers, withdrawals, holds) for an account."""
    acc_norm = normalize_account_identifier(account)
    query = db.query(NcrpTransaction).filter(NcrpTransaction.ncrp_file_id == file_id)
    if case_id is not None:
        query = query.filter(NcrpTransaction.case_id == case_id)
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

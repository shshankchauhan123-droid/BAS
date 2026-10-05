from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.bank_transactions.bank_transaction_model import BankTransaction


# ============================================================
# Create single transaction
# ============================================================

def create_transaction(
    db: Session,
    transaction: BankTransaction,
) -> BankTransaction:
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return transaction


# ============================================================
# Create multiple transactions
# ============================================================

def create_transactions(
    db: Session,
    transactions: list[BankTransaction],
) -> list[BankTransaction]:
    if not transactions:
        return []

    db.add_all(transactions)
    db.commit()

    return transactions


# ============================================================
# Get transactions by file
# ============================================================

def get_transactions_by_file(
    db: Session,
    file_id: int,
) -> list[BankTransaction]:
    return (
        db.query(BankTransaction)
        .filter(
            BankTransaction.file_id == file_id
        )
        .order_by(
            BankTransaction.transaction_date.asc(),
            BankTransaction.id.asc(),
        )
        .all()
    )


# ============================================================
# Get transactions by file - paginated
# ============================================================

def get_transactions_by_file_paginated(
    db: Session,
    file_id: int,
    page: int,
    page_size: int,
):
    query = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.file_id == file_id
        )
        .order_by(
            BankTransaction.transaction_date.asc(),
            BankTransaction.id.asc(),
        )
    )

    total = query.count()

    offset = (page - 1) * page_size

    transactions = (
        query
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return transactions, total


# ============================================================
# Get transactions by case
# ============================================================

def get_transactions_by_case(
    db: Session,
    case_id: int,
) -> list[BankTransaction]:
    return (
        db.query(BankTransaction)
        .filter(
            BankTransaction.case_id == case_id
        )
        .order_by(
            BankTransaction.transaction_date.asc(),
            BankTransaction.id.asc(),
        )
        .all()
    )


# ============================================================
# Get transactions by case - paginated
# ============================================================

def get_transactions_by_case_paginated(
    db: Session,
    case_id: int,
    page: int,
    page_size: int,
):
    query = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.case_id == case_id
        )
        .order_by(
            BankTransaction.transaction_date.asc(),
            BankTransaction.id.asc(),
        )
    )

    total = query.count()

    offset = (page - 1) * page_size

    transactions = (
        query
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return transactions, total


# ============================================================
# Filter + paginate transactions by case
# ============================================================

def get_filtered_transactions_by_case(
    db: Session,
    case_id: int,
    page: int,
    page_size: int,
    file_ids: list[int] | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    transaction_type: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    mode: str | None = None,
    min_balance: Decimal | None = None,
    max_balance: Decimal | None = None,
    has_cheque_only: bool = False,
    exclude_keyword: str | None = None,
    sort_by: str | None = None,
    sort_order: str = 'asc',
):
    query = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.case_id == case_id
        )
    )

    if file_ids:
        query = query.filter(BankTransaction.file_id.in_(file_ids))

    # ========================================================
    # Search
    # ========================================================

    if search:
        search_val_str = search.strip()
        search_value = f"%{search_val_str}%"
        
        amount_val = None
        try:
            amount_val = float(search_val_str)
        except ValueError:
            pass

        if transaction_type == 'debit' and amount_val is not None:
            query = query.filter(BankTransaction.debit == amount_val)
        elif transaction_type == 'credit' and amount_val is not None:
            query = query.filter(BankTransaction.credit == amount_val)
        else:
            query = query.filter(
                BankTransaction.description.ilike(search_value)
                |
                BankTransaction.cheque_number.ilike(search_value)
            )

    # ========================================================
    # Date range
    # ========================================================

    if date_from:
        query = query.filter(
            BankTransaction.transaction_date >= date_from
        )

    if date_to:
        query = query.filter(
            BankTransaction.transaction_date <= date_to
        )

    # ========================================================
    # Transaction type
    # ========================================================

    if transaction_type:
        transaction_type = transaction_type.lower().strip()

        if transaction_type == "debit":
            query = query.filter(
                BankTransaction.debit.isnot(None)
            )

        elif transaction_type == "credit":
            query = query.filter(
                BankTransaction.credit.isnot(None)
            )

        else:
            raise ValueError(
                "transaction_type must be 'debit' or 'credit'"
            )

    # ========================================================
    # Minimum amount
    # ========================================================

    if min_amount is not None:
        query = query.filter(
            (
                BankTransaction.debit >= min_amount
            )
            |
            (
                BankTransaction.credit >= min_amount
            )
        )

    # ========================================================
    # Maximum amount
    # ========================================================

    if max_amount is not None:
        query = query.filter(
            (
                BankTransaction.debit <= max_amount
            )
            |
            (
                BankTransaction.credit <= max_amount
            )
        )

    # ========================================================
    # Additional Filters
    # ========================================================

    if mode and mode.lower() != 'all':
        mode_list = [m.strip().upper() for m in mode.split(',')]
        mode_filters = []
        for m in mode_list:
            if m == 'OTHER':
                mode_filters.append(
                    BankTransaction.mode.is_(None) | 
                    (func.trim(BankTransaction.mode) == '') | 
                    (BankTransaction.mode == '-')
                )
            else:
                mode_filters.append(BankTransaction.mode.ilike(f'%{m}%'))
        
        from sqlalchemy import or_
        if mode_filters:
            query = query.filter(or_(*mode_filters))

    if min_balance is not None:
        query = query.filter(BankTransaction.balance >= min_balance)

    if max_balance is not None:
        query = query.filter(BankTransaction.balance <= max_balance)

    if has_cheque_only:
        query = query.filter(
            BankTransaction.cheque_number.isnot(None),
            BankTransaction.cheque_number != '',
            BankTransaction.cheque_number != '-'
        )

    if exclude_keyword:
        keywords = [kw.strip() for kw in exclude_keyword.split(',') if kw.strip()]
        for kw in keywords:
            query = query.filter(~BankTransaction.description.ilike(f'%{kw}%'))

    # ========================================================
    # Transaction ordering
    # ========================================================

    if sort_by == 'amount':
        if transaction_type == 'debit':
            sort_col = BankTransaction.debit
        elif transaction_type == 'credit':
            sort_col = BankTransaction.credit
        else:
            # Fallback if amount sort is requested without transaction_type
            sort_col = BankTransaction.id
    elif sort_by:
        sort_col = getattr(BankTransaction, sort_by, None)
    else:
        sort_col = None

    if sort_col is not None:
        if sort_order.lower() == 'desc':
            query = query.order_by(sort_col.desc(), BankTransaction.id.desc())
        else:
            query = query.order_by(sort_col.asc(), BankTransaction.id.asc())
    else:
        query = query.order_by(
            BankTransaction.transaction_date.asc(),
            BankTransaction.id.asc(),
        )

    # ========================================================
    # Total AFTER filters
    # ========================================================

    total = query.count()

    # ========================================================
    # Calculate Mode Counts for active filter scope
    # ========================================================
    mode_counts = []
    try:
        mode_groups = (
            db.query(BankTransaction.mode, func.count(BankTransaction.id))
            .filter(query.whereclause)
            .group_by(BankTransaction.mode)
            .all()
        )
        other_count = 0
        for m, c in mode_groups:
            if not m or str(m).strip() == '' or str(m).strip() == '-':
                other_count += c
            else:
                mode_counts.append({"mode": str(m).upper(), "count": c})
        if other_count > 0:
            mode_counts.append({"mode": "OTHER", "count": other_count})
    except Exception as e:
        pass

    # ========================================================
    # Pagination
    # ========================================================

    offset = (page - 1) * page_size

    transactions = (
        query
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return transactions, total, mode_counts


# ============================================================
# Delete transactions by file
# ============================================================

def delete_transactions_by_file(
    db: Session,
    file_id: int,
) -> int:
    transactions = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.file_id == file_id
        )
        .all()
    )

    count = len(transactions)

    for transaction in transactions:
        db.delete(transaction)

    db.commit()

    return count


# ============================================================
# Get transactions summary by file
# ============================================================

def get_file_transaction_summary(db: Session, file_id: int):
    # Calculate total transactions
    total_transactions = (
        db.query(func.count(BankTransaction.id))
        .filter(BankTransaction.file_id == file_id)
        .scalar()
    ) or 0

    # Calculate min and max dates
    dates = (
        db.query(
            func.min(BankTransaction.transaction_date),
            func.max(BankTransaction.transaction_date)
        )
        .filter(BankTransaction.file_id == file_id)
        .first()
    )
    start_date = dates[0] if dates else None
    end_date = dates[1] if dates else None

    # Calculate total debits
    total_debits = (
        db.query(func.sum(BankTransaction.debit))
        .filter(BankTransaction.file_id == file_id)
        .scalar()
    ) or Decimal("0.0")

    # Calculate total credits
    total_credits = (
        db.query(func.sum(BankTransaction.credit))
        .filter(BankTransaction.file_id == file_id)
        .scalar()
    ) or Decimal("0.0")

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_transactions": total_transactions,
        "total_debits": total_debits,
        "total_credits": total_credits
    }


# ============================================================
# Get transactions summary by case and file_ids
# ============================================================

def get_case_transaction_summary(db: Session, case_id: int, file_ids: list[int] | None = None):
    # Calculate total transactions
    query_count = db.query(func.count(BankTransaction.id)).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query_count = query_count.filter(BankTransaction.file_id.in_(file_ids))
    total_transactions = query_count.scalar() or 0

    # Calculate min and max dates
    query_dates = db.query(
        func.min(BankTransaction.transaction_date),
        func.max(BankTransaction.transaction_date)
    ).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query_dates = query_dates.filter(BankTransaction.file_id.in_(file_ids))
    dates = query_dates.first()
    
    start_date = dates[0] if dates else None
    end_date = dates[1] if dates else None

    # Calculate total debits
    query_debits = db.query(func.sum(BankTransaction.debit)).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query_debits = query_debits.filter(BankTransaction.file_id.in_(file_ids))
    total_debits = query_debits.scalar() or Decimal("0.0")

    # Calculate total credits
    query_credits = db.query(func.sum(BankTransaction.credit)).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query_credits = query_credits.filter(BankTransaction.file_id.in_(file_ids))
    total_credits = query_credits.scalar() or Decimal("0.0")

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_transactions": total_transactions,
        "total_debits": total_debits,
        "total_credits": total_credits
    }


# ============================================================
# Timeline Aggregation
# ============================================================


def get_mode_wise_by_case(
    db: Session,
    case_id: int,
    file_ids: list[int] = None,
):
    query = db.query(BankTransaction).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query = query.filter(BankTransaction.file_id.in_(file_ids))

    results = db.query(
        BankTransaction.mode,
        func.count(BankTransaction.id).label('tx_count'),
        func.sum(case((BankTransaction.debit > 0, 1), else_=0)).label('debit_count'),
        func.sum(case((BankTransaction.credit > 0, 1), else_=0)).label('credit_count'),
        func.sum(func.coalesce(BankTransaction.debit, 0)).label('debit_amount'),
        func.sum(func.coalesce(BankTransaction.credit, 0)).label('credit_amount')
    ).filter(query.whereclause).group_by(BankTransaction.mode).all()
    
    total_transactions = 0
    modes_dict = {}

    for row in results:
        m = row.mode
        if not m or str(m).strip() == '' or str(m).strip() == '-':
            mode_label = 'OTHER'
        else:
            mode_label = str(m).upper()
            
        if mode_label not in modes_dict:
            modes_dict[mode_label] = {
                'mode': mode_label,
                'transaction_count': 0,
                'debit_count': 0,
                'credit_count': 0,
                'debit_amount': 0.0,
                'credit_amount': 0.0
            }
            
        modes_dict[mode_label]['transaction_count'] += row.tx_count
        modes_dict[mode_label]['debit_count'] += row.debit_count
        modes_dict[mode_label]['credit_count'] += row.credit_count
        modes_dict[mode_label]['debit_amount'] += float(row.debit_amount or 0)
        modes_dict[mode_label]['credit_amount'] += float(row.credit_amount or 0)
        
        total_transactions += row.tx_count

    modes_list = list(modes_dict.values())
    
    # Sort modes by transaction count descending
    modes_list.sort(key=lambda x: x['transaction_count'], reverse=True)

    return {
        "total_transactions": total_transactions,
        "modes": modes_list
    }

def get_timeline_by_case(
    db: Session,
    case_id: int,
    file_ids: list[int] = None,
    requested_interval: str = None,
):
    query = db.query(BankTransaction).filter(BankTransaction.case_id == case_id)
    if file_ids:
        query = query.filter(BankTransaction.file_id.in_(file_ids))

    stats = db.query(
        func.min(BankTransaction.transaction_date),
        func.max(BankTransaction.transaction_date),
        func.count(BankTransaction.id)
    ).filter(query.whereclause).first()
    
    if not stats or not stats[0] or stats[2] == 0:
        return {"interval": "day", "data": []}
        
    min_date = stats[0]
    max_date = stats[1]
    
    if requested_interval and requested_interval in ['day', 'week', 'month', 'quarter', 'year']:
        interval = requested_interval
    else:
        days_diff = (max_date - min_date).days
        
        if days_diff <= 60:
            interval = 'day'
        elif days_diff <= 180:
            interval = 'week'
        elif days_diff <= 730:
            interval = 'month'
        elif days_diff <= 2000:
            interval = 'quarter'
        else:
            interval = 'year'
        
    bucket_col = func.date_trunc(interval, BankTransaction.transaction_date).label('bucket')
    
    results = db.query(
        bucket_col,
        BankTransaction.mode,
        func.count(BankTransaction.id).label('tx_count'),
        func.sum(case((BankTransaction.debit > 0, 1), else_=0)).label('debit_count'),
        func.sum(case((BankTransaction.credit > 0, 1), else_=0)).label('credit_count'),
        func.sum(func.coalesce(BankTransaction.debit, 0)).label('debit_amount'),
        func.sum(func.coalesce(BankTransaction.credit, 0)).label('credit_amount')
    ).filter(query.whereclause).group_by(bucket_col, BankTransaction.mode).order_by(bucket_col).all()
    
    bucket_map = {}
    
    for row in results:
        b_val = row.bucket
        if not b_val:
            continue
            
        b_date = b_val.date() if hasattr(b_val, 'date') else b_val
        b_str = str(b_date)
        
        if b_str not in bucket_map:
            bucket_map[b_str] = {
                "bucket_start": b_str,
                "bucket_end": b_str,
                "transaction_count": 0,
                "debit_count": 0,
                "credit_count": 0,
                "debit_amount": 0.0,
                "credit_amount": 0.0,
                "mode_counts": {}
            }
            
        b = bucket_map[b_str]
        b["transaction_count"] += row.tx_count
        b["debit_count"] += row.debit_count
        b["credit_count"] += row.credit_count
        b["debit_amount"] += float(row.debit_amount or 0)
        b["credit_amount"] += float(row.credit_amount or 0)
        
        mode_val = row.mode if hasattr(row, 'mode') else None
        if mode_val:
            b["mode_counts"][mode_val] = b["mode_counts"].get(mode_val, 0) + row.tx_count

    return {
        "interval": interval,
        "data": list(bucket_map.values())
    }
# ============================================================
# Transaction Relationships
# ============================================================

def get_transaction_relationships(
    db: Session,
    case_id: int,
    file_ids: list[int],
    transaction_mode: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    transaction_type: str | None = None,
):
    from app.files.file_model import File
    
    # Get details for all requested files
    files = db.query(File).filter(File.id.in_(file_ids), File.case_id == case_id).all()
    if not files:
        return {"case_id": case_id, "filters": {}, "nodes": [], "edges": [], "transactions": [], "summary": {}}
    
    valid_file_ids = [f.id for f in files]
    
    # Prepare Nodes
    nodes_map = {}
    for f in files:
        nodes_map[f.id] = {
            "id": f"file-{f.id}",
            "file_id": f.id,
            "file_name": f.original_filename or f"Statement {f.id}",
            "account_name": f.account_name,
            "account_number": f.account_number,
            "bank_name": f.bank_name,
            "matching_transaction_count": 0,
            "total_debit_amount": 0.0,
            "total_credit_amount": 0.0,
        }
    
    # Query transactions from valid files
    query = db.query(BankTransaction).filter(BankTransaction.file_id.in_(valid_file_ids))
    
    if transaction_mode and transaction_mode.lower() != "all":
        query = query.filter(BankTransaction.mode.ilike(f"%{transaction_mode.strip()}%"))
        
    if min_amount is not None:
        query = query.filter((BankTransaction.debit >= min_amount) | (BankTransaction.credit >= min_amount))
        
    if max_amount is not None:
        query = query.filter((BankTransaction.debit <= max_amount) | (BankTransaction.credit <= max_amount))
        
    if transaction_type and transaction_type.lower() != "all":
        ttype = transaction_type.lower().strip()
        if ttype == "debit":
            query = query.filter(BankTransaction.debit.isnot(None), BankTransaction.debit > 0)
        elif ttype == "credit":
            query = query.filter(BankTransaction.credit.isnot(None), BankTransaction.credit > 0)
            
    transactions = query.all()
    
    edges_map = {}
    graph_transactions = []
    
    summary_tx_count = 0
    summary_debit = 0.0
    summary_credit = 0.0
    
    for tx in transactions:
        dr = float(tx.debit or 0.0)
        cr = float(tx.credit or 0.0)
        
        summary_tx_count += 1
        summary_debit += dr
        summary_credit += cr
        
        # Update node stats for the file that owns this transaction
        if tx.file_id in nodes_map:
            nodes_map[tx.file_id]["matching_transaction_count"] += 1
            nodes_map[tx.file_id]["total_debit_amount"] += dr
            nodes_map[tx.file_id]["total_credit_amount"] += cr
            
        graph_tx = {
            "id": tx.id,
            "file_id": tx.file_id,
            "transaction_date": tx.transaction_date,
            "amount": max(dr, cr),
            "debit": dr,
            "credit": cr,
            "mode": tx.mode,
            "reference_number": tx.cheque_number,
            "description": tx.description
        }
        graph_transactions.append(graph_tx)
        
        # Determine counterparty by account number or account name (only if 2+ files selected)
        if len(files) >= 2:
            target_file_id = None
            tx_ac_num = (tx.account_number or "").strip()
            tx_ac_name = (tx.account_name or "").strip().lower()
            
            if tx_ac_num or tx_ac_name:
                for f in files:
                    if f.id == tx.file_id:
                        continue
                        
                    f_ac_num = (f.account_number or "").strip()
                    f_ac_name = (f.account_name or "").strip().lower()
                    
                    if tx_ac_num and f_ac_num and tx_ac_num == f_ac_num:
                        target_file_id = f.id
                        break
                    elif tx_ac_name and f_ac_name and tx_ac_name == f_ac_name:
                        target_file_id = f.id
                        break
                        
            if target_file_id:
                source = f"file-{tx.file_id}"
                target = f"file-{target_file_id}"
                
                # For simplicity, keep a directed edge
                edge_id = f"{source}-{target}"
                if edge_id not in edges_map:
                    edges_map[edge_id] = {
                        "id": edge_id,
                        "source": source,
                        "target": target,
                        "transaction_count": 0,
                        "total_amount": 0.0,
                        "transactions": []
                    }
                    
                edges_map[edge_id]["transaction_count"] += 1
                edges_map[edge_id]["total_amount"] += max(dr, cr)
                edges_map[edge_id]["transactions"].append(graph_tx)

    summary = {
        "transaction_count": summary_tx_count,
        "relationship_count": len(edges_map),
        "total_debit": summary_debit,
        "total_credit": summary_credit
    }
    
    return {
        "case_id": case_id,
        "filters": {
            "file_ids": valid_file_ids,
            "transaction_mode": transaction_mode,
            "min_amount": float(min_amount) if min_amount else None,
            "max_amount": float(max_amount) if max_amount else None,
            "transaction_type": transaction_type
        },
        "nodes": list(nodes_map.values()),
        "edges": list(edges_map.values()),
        "transactions": graph_transactions,
        "summary": summary
    }


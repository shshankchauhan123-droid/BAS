from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, and_, not_, extract
from sqlalchemy.orm import Session

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
            BankTransaction.source_page.asc(),
            BankTransaction.source_row.asc(),
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
            BankTransaction.source_page.asc(),
            BankTransaction.source_row.asc(),
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
            BankTransaction.source_page.asc(),
            BankTransaction.source_row.asc(),
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
            BankTransaction.source_page.asc(),
            BankTransaction.source_row.asc(),
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
    file_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    transaction_type: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    channel: str | None = None,
    day_type: str | None = None,
    amount_pattern: str | None = None,
    exclude_keyword: str | None = None,
    min_balance: Decimal | None = None,
    max_balance: Decimal | None = None,
    is_low_balance: bool | None = None,
    has_cheque_only: bool | None = None,
    has_reference_only: bool | None = None,
    source_page: int | None = None,
):
    query = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.case_id == case_id
        )
    )

    if file_id is not None:
        query = query.filter(
            BankTransaction.file_id == file_id
        )

    # ========================================================
    # 1. Search Query
    # ========================================================

    if search:
        search_value = f"%{search.strip()}%"

        query = query.filter(
            BankTransaction.description.ilike(search_value)
            |
            BankTransaction.reference_number.ilike(search_value)
            |
            BankTransaction.cheque_number.ilike(search_value)
        )

    # ========================================================
    # 2. Exclude Keywords
    # ========================================================

    if exclude_keyword:
        keywords = [k.strip() for k in exclude_keyword.split(",") if k.strip()]
        for kw in keywords:
            query = query.filter(
                ~BankTransaction.description.ilike(f"%{kw}%")
            )

    # ========================================================
    # 3. Date range
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
    # 4. Day Type (Weekday vs Weekend)
    # ========================================================

    if day_type:
        day_type = day_type.lower().strip()
        # In PostgreSQL/standard SQL: dow: 0=Sunday, 6=Saturday
        if day_type == "weekend":
            query = query.filter(
                extract("dow", BankTransaction.transaction_date).in_([0, 6])
            )
        elif day_type == "weekday":
            query = query.filter(
                extract("dow", BankTransaction.transaction_date).between(1, 5)
            )

    # ========================================================
    # 5. Transaction Type (Debit vs Credit)
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

        elif transaction_type not in ("", "all"):
            raise ValueError(
                "transaction_type must be 'debit' or 'credit'"
            )

    # ========================================================
    # 6. Payment Channel / Mode
    # ========================================================

    if channel:
        c = channel.lower().strip()
        if c == "upi":
            query = query.filter(
                or_(
                    BankTransaction.description.ilike("%upi%"),
                    BankTransaction.description.ilike("%vpa%"),
                    BankTransaction.description.ilike("%@%"),
                    BankTransaction.reference_number.ilike("%upi%"),
                )
            )
        elif c == "imps":
            query = query.filter(
                BankTransaction.description.ilike("%imps%")
            )
        elif c in ("neft", "rtgs", "neft_rtgs"):
            query = query.filter(
                or_(
                    BankTransaction.description.ilike("%neft%"),
                    BankTransaction.description.ilike("%rtgs%"),
                )
            )
        elif c == "atm":
            query = query.filter(
                or_(
                    BankTransaction.description.ilike("%atm%"),
                    BankTransaction.description.ilike("%cash wdl%"),
                    BankTransaction.description.ilike("%nwd%"),
                    BankTransaction.description.ilike("%atw%"),
                )
            )
        elif c in ("cash_deposit", "cash"):
            query = query.filter(
                or_(
                    BankTransaction.description.ilike("%cdm%"),
                    BankTransaction.description.ilike("%cash dep%"),
                    BankTransaction.description.ilike("%by cash%"),
                    BankTransaction.description.ilike("%csh%"),
                )
            )
        elif c == "cheque":
            query = query.filter(
                or_(
                    and_(BankTransaction.cheque_number.isnot(None), BankTransaction.cheque_number != ""),
                    BankTransaction.description.ilike("%chq%"),
                    BankTransaction.description.ilike("%cheque%"),
                    BankTransaction.description.ilike("%clr%"),
                )
            )
        elif c == "pos":
            query = query.filter(
                or_(
                    BankTransaction.description.ilike("%pos%"),
                    BankTransaction.description.ilike("%e-comm%"),
                    BankTransaction.description.ilike("%swipe%"),
                    BankTransaction.description.ilike("%visa%"),
                    BankTransaction.description.ilike("%mastercard%"),
                    BankTransaction.description.ilike("%rupay%"),
                )
            )
        elif c == "charges":
            query = query.filter(
                or_(
                    BankTransaction.description.ilike("%chrg%"),
                    BankTransaction.description.ilike("%charge%"),
                    BankTransaction.description.ilike("%fee%"),
                    BankTransaction.description.ilike("%gst%"),
                    BankTransaction.description.ilike("%int.pd%"),
                    BankTransaction.description.ilike("%penalty%"),
                )
            )
        elif c == "nach":
            query = query.filter(
                or_(
                    BankTransaction.description.ilike("%nach%"),
                    BankTransaction.description.ilike("%ach%"),
                    BankTransaction.description.ilike("%ecs%"),
                    BankTransaction.description.ilike("%mandate%"),
                    BankTransaction.description.ilike("%emi%"),
                )
            )

    # ========================================================
    # 7. Amount Limits (Min / Max)
    # ========================================================

    if min_amount is not None:
        query = query.filter(
            (BankTransaction.debit >= min_amount)
            | (BankTransaction.credit >= min_amount)
        )

    if max_amount is not None:
        query = query.filter(
            (BankTransaction.debit <= max_amount)
            | (BankTransaction.credit <= max_amount)
        )

    # ========================================================
    # 8. Amount Patterns & Forensic Thresholds
    # ========================================================

    if amount_pattern:
        ap = amount_pattern.lower().strip()
        if ap == "above_50k":
            query = query.filter(
                or_(BankTransaction.debit >= 50000, BankTransaction.credit >= 50000)
            )
        elif ap == "above_100k":
            query = query.filter(
                or_(BankTransaction.debit >= 100000, BankTransaction.credit >= 100000)
            )
        elif ap == "above_1000k":
            query = query.filter(
                or_(BankTransaction.debit >= 1000000, BankTransaction.credit >= 1000000)
            )
        elif ap == "round_figure":
            query = query.filter(
                or_(
                    and_(BankTransaction.debit.isnot(None), func.mod(BankTransaction.debit, 1000) == 0),
                    and_(BankTransaction.credit.isnot(None), func.mod(BankTransaction.credit, 1000) == 0),
                )
            )
        elif ap == "smurfing_sub50k":
            query = query.filter(
                or_(
                    and_(BankTransaction.debit >= 45000, BankTransaction.debit < 50000),
                    and_(BankTransaction.credit >= 45000, BankTransaction.credit < 50000),
                )
            )

    # ========================================================
    # 9. Balance Tracking Filters
    # ========================================================

    if min_balance is not None:
        query = query.filter(BankTransaction.balance >= min_balance)

    if max_balance is not None:
        query = query.filter(BankTransaction.balance <= max_balance)

    if is_low_balance:
        query = query.filter(
            and_(BankTransaction.balance.isnot(None), BankTransaction.balance <= 1000)
        )

    # ========================================================
    # 10. Metadata / Identification Flags
    # ========================================================

    if has_cheque_only:
        query = query.filter(
            and_(BankTransaction.cheque_number.isnot(None), BankTransaction.cheque_number != "")
        )

    if has_reference_only:
        query = query.filter(
            and_(BankTransaction.reference_number.isnot(None), BankTransaction.reference_number != "")
        )

    if source_page is not None:
        query = query.filter(BankTransaction.source_page == source_page)

    # ========================================================
    # Stable transaction ordering
    # ========================================================

    query = query.order_by(
        BankTransaction.transaction_date.asc(),
        BankTransaction.source_page.asc(),
        BankTransaction.source_row.asc(),
    )

    # ========================================================
    # Total AFTER filters
    # ========================================================

    total = query.count()

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

    return transactions, total


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
# Get transaction summary for a file
# ============================================================

def get_file_transaction_summary(
    db: Session,
    file_id: int,
):
    from sqlalchemy import func

    stats = (
        db.query(
            func.count(BankTransaction.id).label("total_transactions"),
            func.coalesce(func.sum(BankTransaction.debit), 0).label("total_debit"),
            func.coalesce(func.sum(BankTransaction.credit), 0).label("total_credit"),
            func.min(BankTransaction.transaction_date).label("start_date"),
            func.max(BankTransaction.transaction_date).label("end_date"),
            func.max(BankTransaction.debit).label("max_debit"),
            func.max(BankTransaction.credit).label("max_credit"),
        )
        .filter(BankTransaction.file_id == file_id)
        .first()
    )

    first_tx = (
        db.query(BankTransaction)
        .filter(BankTransaction.file_id == file_id)
        .order_by(BankTransaction.transaction_date.asc(), BankTransaction.id.asc())
        .first()
    )

    last_tx = (
        db.query(BankTransaction)
        .filter(BankTransaction.file_id == file_id)
        .order_by(BankTransaction.transaction_date.desc(), BankTransaction.id.desc())
        .first()
    )

    total_debit = float(stats.total_debit or 0)
    total_credit = float(stats.total_credit or 0)
    opening_balance = float(first_tx.balance) if first_tx and first_tx.balance is not None else None
    closing_balance = float(last_tx.balance) if last_tx and last_tx.balance is not None else None

    return {
        "file_id": file_id,
        "total_transactions": stats.total_transactions or 0,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "net_movement": total_credit - total_debit,
        "start_date": str(stats.start_date) if stats.start_date else None,
        "end_date": str(stats.end_date) if stats.end_date else None,
        "max_debit": float(stats.max_debit) if stats.max_debit is not None else None,
        "max_credit": float(stats.max_credit) if stats.max_credit is not None else None,
        "opening_balance": opening_balance,
        "closing_balance": closing_balance,
    }
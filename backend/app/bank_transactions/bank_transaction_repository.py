from datetime import date
from decimal import Decimal

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
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    transaction_type: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
):
    query = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.case_id == case_id
        )
    )

    # ========================================================
    # Search
    # ========================================================

    if search:
        search_value = f"%{search.strip()}%"

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
    # Stable transaction ordering
    # ========================================================

    query = query.order_by(
        BankTransaction.transaction_date.asc(),
        BankTransaction.id.asc(),
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
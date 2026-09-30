import math
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.bank_transactions.bank_transaction_repository import (
    get_filtered_transactions_by_case,
    get_transactions_by_case_paginated,
    get_transactions_by_file_paginated,
    get_file_transaction_summary,
)

from app.bank_transactions.bank_transaction_schema import (
    BankTransactionListResponse,
)


router = APIRouter(
    prefix="/api/v1/bank-transactions",
    tags=["Bank Transactions"],
)


# ============================================================
# Get transactions by file
# ============================================================

@router.get(
    "/file/{file_id}",
    response_model=BankTransactionListResponse,
)
def get_file_transactions(
    file_id: int,
    page: int = Query(
        default=1,
        ge=1,
        description="Page number",
    ),
    page_size: int = Query(
        default=50,
        ge=1,
        le=100,
        description="Number of transactions per page",
    ),
    db: Session = Depends(get_db),
):
    transactions, total = get_transactions_by_file_paginated(
        db=db,
        file_id=file_id,
        page=page,
        page_size=page_size,
    )

    total_pages = (
        math.ceil(total / page_size)
        if total > 0
        else 0
    )

    return BankTransactionListResponse(
        success=True,
        message="Bank transactions retrieved successfully.",
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=transactions,
    )


# ============================================================
# Get transactions by case
# ============================================================

@router.get(
    "/case/{case_id}",
    response_model=BankTransactionListResponse,
)
def get_case_transactions(
    case_id: int,
    page: int = Query(
        default=1,
        ge=1,
        description="Page number",
    ),
    page_size: int = Query(
        default=50,
        ge=1,
        le=100,
        description="Number of transactions per page",
    ),
    db: Session = Depends(get_db),
):
    transactions, total = get_transactions_by_case_paginated(
        db=db,
        case_id=case_id,
        page=page,
        page_size=page_size,
    )

    total_pages = (
        math.ceil(total / page_size)
        if total > 0
        else 0
    )

    return BankTransactionListResponse(
        success=True,
        message="Case transactions retrieved successfully.",
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=transactions,
    )


# ============================================================
# Search / Filter transactions by case
# ============================================================

@router.get(
    "/case/{case_id}/search",
    response_model=BankTransactionListResponse,
)
def search_case_transactions(
    case_id: int,

    file_id: int | None = Query(
        default=None,
        description="Filter by specific file ID",
    ),

    search: str | None = Query(
        default=None,
        description=(
            "Search description, reference number "
            "or cheque number"
        ),
    ),

    date_from: date | None = Query(
        default=None,
        description="Transaction date from",
    ),

    date_to: date | None = Query(
        default=None,
        description="Transaction date to",
    ),

    transaction_type: str | None = Query(
        default=None,
        description="Transaction type: debit or credit",
    ),

    min_amount: Decimal | None = Query(
        default=None,
        ge=0,
        description="Minimum transaction amount",
    ),

    max_amount: Decimal | None = Query(
        default=None,
        ge=0,
        description="Maximum transaction amount",
    ),

    channel: str | None = Query(
        default=None,
        description="Payment channel: upi, imps, neft_rtgs, atm, cash_deposit, cheque, pos, charges, nach",
    ),

    day_type: str | None = Query(
        default=None,
        description="Day type: weekday or weekend",
    ),

    amount_pattern: str | None = Query(
        default=None,
        description="Amount pattern: above_50k, above_100k, above_1000k, round_figure, smurfing_sub50k",
    ),

    exclude_keyword: str | None = Query(
        default=None,
        description="Exclude keywords in description (comma separated)",
    ),

    min_balance: Decimal | None = Query(
        default=None,
        description="Minimum account balance",
    ),

    max_balance: Decimal | None = Query(
        default=None,
        description="Maximum account balance",
    ),

    is_low_balance: bool | None = Query(
        default=None,
        description="Filter low / overdraft balance transactions (balance <= 1000)",
    ),

    has_cheque_only: bool | None = Query(
        default=None,
        description="Filter only transactions containing cheque numbers",
    ),

    has_reference_only: bool | None = Query(
        default=None,
        description="Filter only transactions containing reference / UTR numbers",
    ),

    source_page: int | None = Query(
        default=None,
        ge=1,
        description="Filter by source statement page number",
    ),

    page: int = Query(
        default=1,
        ge=1,
        description="Page number",
    ),

    page_size: int = Query(
        default=50,
        ge=1,
        le=500,
        description="Number of transactions per page",
    ),

    db: Session = Depends(get_db),
):
    transactions, total = get_filtered_transactions_by_case(
        db=db,
        case_id=case_id,
        page=page,
        page_size=page_size,
        file_id=file_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        transaction_type=transaction_type,
        min_amount=min_amount,
        max_amount=max_amount,
        channel=channel,
        day_type=day_type,
        amount_pattern=amount_pattern,
        exclude_keyword=exclude_keyword,
        min_balance=min_balance,
        max_balance=max_balance,
        is_low_balance=is_low_balance,
        has_cheque_only=has_cheque_only,
        has_reference_only=has_reference_only,
        source_page=source_page,
    )

    total_pages = (
        math.ceil(total / page_size)
        if total > 0
        else 0
    )

    return BankTransactionListResponse(
        success=True,
        message="Filtered case transactions retrieved successfully.",
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=transactions,
    )


# ============================================================
# Get file transaction summary report
# ============================================================

@router.get(
    "/file/{file_id}/summary",
)
def get_file_summary_route(
    file_id: int,
    db: Session = Depends(get_db),
):
    summary = get_file_transaction_summary(
        db=db,
        file_id=file_id,
    )

    return {
        "success": True,
        "message": "File transaction summary retrieved successfully.",
        "data": summary,
    }
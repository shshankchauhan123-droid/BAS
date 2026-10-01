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
    get_case_transaction_summary,
)
from app.files.file_service import get_case_files
from fastapi import HTTPException

from app.bank_transactions.bank_transaction_schema import (
    BankTransactionListResponse,
    TransactionSummaryResponse,
)
from app.dependencies.auth import get_current_user


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

    file_ids: str | None = Query(
        default=None,
        description="Comma-separated list of file IDs to filter by",
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
    current_user=Depends(get_current_user),
):
    parsed_file_ids = None
    if file_ids:
        try:
            parsed_file_ids = [int(fid.strip()) for fid in file_ids.split(",") if fid.strip()]
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid file_ids format")
            
        if parsed_file_ids:
            # Validate that all requested files belong to this case
            valid_case_files = get_case_files(case_id=case_id, db=db, user=current_user)
            valid_file_ids_set = {f.id for f in valid_case_files}
            invalid_ids = [fid for fid in parsed_file_ids if fid not in valid_file_ids_set]
            
            if invalid_ids:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Files {invalid_ids} do not belong to case {case_id}"
                )

    transactions, total = get_filtered_transactions_by_case(
        db=db,
        case_id=case_id,
        page=page,
        page_size=page_size,
        file_ids=parsed_file_ids,
        search=search,
        date_from=date_from,
        date_to=date_to,
        transaction_type=transaction_type,
        min_amount=min_amount,
        max_amount=max_amount,
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
# Get transactions summary by file
# ============================================================

@router.get(
    "/file/{file_id}/summary",
    response_model=TransactionSummaryResponse,
)
def get_file_summary(
    file_id: int,
    db: Session = Depends(get_db),
):
    summary_data = get_file_transaction_summary(db=db, file_id=file_id)

    return TransactionSummaryResponse(
        success=True,
        message="File transaction summary retrieved successfully.",
        data=summary_data,
    )


# ============================================================
# Get transactions summary by case and selected files
# ============================================================

@router.get(
    "/case/{case_id}/summary",
    response_model=TransactionSummaryResponse,
)
def get_case_summary(
    case_id: int,
    file_ids: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    parsed_file_ids = None
    if file_ids:
        try:
            parsed_file_ids = [int(fid.strip()) for fid in file_ids.split(",") if fid.strip()]
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid file_ids format")
            
        if parsed_file_ids:
            # Validate that all requested files belong to this case
            valid_case_files = get_case_files(case_id=case_id, db=db, user=current_user)
            valid_file_ids_set = {f.id for f in valid_case_files}
            invalid_ids = [fid for fid in parsed_file_ids if fid not in valid_file_ids_set]
            
            if invalid_ids:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Files {invalid_ids} do not belong to case {case_id}"
                )

    summary_data = get_case_transaction_summary(db=db, case_id=case_id, file_ids=parsed_file_ids)

    return TransactionSummaryResponse(
        success=True,
        message="Case transaction summary retrieved successfully.",
        data=summary_data,
    )
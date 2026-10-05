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
    get_timeline_by_case, get_mode_wise_by_case,
    get_transaction_relationships,
)
from app.files.file_service import get_case_files
from fastapi import HTTPException

from app.bank_transactions.bank_transaction_schema import (
    BankTransactionListResponse,
    TransactionSummaryResponse,
    TimelineResponse, ModeWiseResponse,
    TransactionRelationshipResponse,
)
from app.dependencies.auth import get_current_user
from app.bank_transactions.transaction_mode_service import get_all_modes


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
# Get transactions mode wise by case
# ============================================================

@router.get(
    "/case/{case_id}/mode-wise",
    response_model=ModeWiseResponse,
)
def get_case_transactions_mode_wise(
    case_id: int,
    file_ids: str | None = Query(
        default=None,
        description="Comma-separated list of file IDs to filter by",
    ),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    parsed_file_ids = None
    if file_ids:
        try:
            parsed_file_ids = [int(f.strip()) for f in file_ids.split(",") if f.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid file_ids format")
            
        case_files = get_case_files(db, case_id, user)
        valid_file_ids = {f.id for f in case_files}
        invalid_ids = [f for f in parsed_file_ids if f not in valid_file_ids]
        if invalid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Files {invalid_ids} do not belong to case {case_id}"
            )

    mode_data = get_mode_wise_by_case(
        db=db,
        case_id=case_id,
        file_ids=parsed_file_ids,
    )

    return ModeWiseResponse(
        success=True,
        message="Case mode-wise data retrieved successfully.",
        total_transactions=mode_data["total_transactions"],
        data=mode_data["modes"],
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

    mode: str | None = Query(
        default=None,
        description="Filter by transaction mode or channel (e.g. UPI, NEFT, CASH)",
    ),

    min_balance: Decimal | None = Query(
        default=None,
        description="Minimum post-transaction balance",
    ),

    max_balance: Decimal | None = Query(
        default=None,
        description="Maximum post-transaction balance",
    ),

    has_cheque_only: bool = Query(
        default=False,
        description="Show only transactions with cheque or reference number",
    ),

    exclude_keyword: str | None = Query(
        default=None,
        description="Exclude comma-separated routine keywords from narration",
    ),

    sort_by: str | None = Query(
        default=None,
        description="Column to sort by (transaction_date, debit, credit, balance, description)",
    ),

    sort_order: str = Query(
        default="asc",
        description="Sort direction: asc or desc",
    ),

    page: int = Query(
        default=1,
        ge=1,
        description="Page number",
    ),

    page_size: int = Query(
        default=50,
        ge=1,
        le=50000,
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

    transactions, total, mode_counts = get_filtered_transactions_by_case(
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
        mode=mode,
        min_balance=min_balance,
        max_balance=max_balance,
        has_cheque_only=has_cheque_only,
        exclude_keyword=exclude_keyword,
        sort_by=sort_by,
        sort_order=sort_order,
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
        mode_counts=mode_counts,
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
    if str(current_user.role).lower() == "user":
        perms = getattr(current_user, "permissions", None)
        if perms and getattr(perms, "can_view_reports", True) is False:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view reports.",
            )

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


# ============================================================
# Get all transaction modes from database
# ============================================================

@router.get(
    "/transaction-modes",
    summary="Get all available transaction modes from the database",
)
def get_transaction_modes(
    db: Session = Depends(get_db),
):
    modes = get_all_modes(db)
    return {
        "success": True,
        "message": "Transaction modes retrieved successfully.",
        "data": modes,
    }
# ============================================================
# Get Transaction Relationships (Graph Data)
# ============================================================

@router.get(
    "/case/{case_id}/transaction-relationships",
    response_model=TransactionRelationshipResponse,
)
def get_transaction_relationships_route(
    case_id: int,
    file_ids: str = Query(
        ...,
        description="Comma-separated list of file IDs to analyze"
    ),
    transaction_mode: str | None = Query(
        default=None,
        description="Transaction mode/channel filter"
    ),
    min_amount: Decimal | None = Query(
        default=None,
        description="Minimum amount filter"
    ),
    max_amount: Decimal | None = Query(
        default=None,
        description="Maximum amount filter"
    ),
    transaction_type: str | None = Query(
        default=None,
        description="Debit or Credit filter"
    ),
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        parsed_file_ids = [int(f.strip()) for f in file_ids.split(",") if f.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_ids format")

    if len(parsed_file_ids) < 1:
        return TransactionRelationshipResponse(
            success=True,
            message="Need at least 1 file to show relationships or transactions.",
            data={
                "case_id": case_id,
                "filters": {"file_ids": parsed_file_ids},
                "nodes": [],
                "edges": [],
                "transactions": [],
                "summary": {}
            }
        )
        
    # Verify file ownership logic here
    case_files = get_case_files(db, case_id, user)
    valid_file_ids = {f.id for f in case_files}
    invalid_ids = [f for f in parsed_file_ids if f not in valid_file_ids]
    if invalid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Files {invalid_ids} do not belong to case {case_id} or you lack permissions."
        )

    graph_data = get_transaction_relationships(
        db=db,
        case_id=case_id,
        file_ids=parsed_file_ids,
        transaction_mode=transaction_mode,
        min_amount=min_amount,
        max_amount=max_amount,
        transaction_type=transaction_type
    )

    return TransactionRelationshipResponse(
        success=True,
        message="Transaction relationships retrieved successfully.",
        data=graph_data
    )

from fastapi.responses import StreamingResponse
import io
import csv

@router.get(
    "/case/{case_id}/export",
)
def export_case_transactions(
    case_id: int,
    file_ids: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    transaction_type: str | None = Query(default=None),
    min_amount: Decimal | None = Query(default=None),
    max_amount: Decimal | None = Query(default=None),
    mode: str | None = Query(default=None),
    min_balance: Decimal | None = Query(default=None),
    max_balance: Decimal | None = Query(default=None),
    has_cheque_only: bool = Query(default=False),
    exclude_keyword: str | None = Query(default=None),
    sort_by: str | None = Query(default=None),
    sort_order: str = Query(default="asc"),
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
            valid_case_files = get_case_files(case_id=case_id, db=db, user=current_user)
            valid_file_ids_set = {f.id for f in valid_case_files}
            invalid_ids = [fid for fid in parsed_file_ids if fid not in valid_file_ids_set]
            
            if invalid_ids:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Files {invalid_ids} do not belong to case {case_id}"
                )

    transactions, _, _ = get_filtered_transactions_by_case(
        db=db,
        case_id=case_id,
        page=1,
        page_size=1000000,
        file_ids=parsed_file_ids,
        search=search,
        date_from=date_from,
        date_to=date_to,
        transaction_type=transaction_type,
        min_amount=min_amount,
        max_amount=max_amount,
        mode=mode,
        min_balance=min_balance,
        max_balance=max_balance,
        has_cheque_only=has_cheque_only,
        exclude_keyword=exclude_keyword,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Account Name",
        "Account Number",
        "Mode / Channel",
        "Description",
        "Debit",
        "Credit",
        "Balance",
        "Cheque Number"
    ])
    for tx in transactions:
        writer.writerow([
            tx.transaction_date,
            tx.account_name,
            tx.account_number,
            tx.mode,
            tx.description,
            tx.debit if tx.debit is not None else '',
            tx.credit if tx.credit is not None else '',
            tx.balance if tx.balance is not None else '',
            tx.cheque_number
        ])
    
    output.seek(0)
    filename = f"bank-statement-transaction-report-case-{case_id}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File as FastAPIFile,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.ncrp.ncrp_repository import (
    get_ncrp_transactions_by_file,
    get_ncrp_transactions_paginated,
)
from app.ncrp.ncrp_schema import (
    NcrpAccountProfileResponse,
    NcrpFileResponse,
    NcrpLayerActivityResponse,
    NcrpReconcileResponse,
    NcrpSankeyResponse,
    NcrpTraceNextResponse,
    NcrpTransactionPaginatedResponse,
    NcrpTransactionResponse,
    NcrpUploadResponse,
)
from app.ncrp.ncrp_service import (
    delete_ncrp_file_service,
    get_case_ncrp_files_service,
    get_ncrp_account_profile_service,
    get_ncrp_file_service,
    get_ncrp_layer_activity_service,
    get_ncrp_sankey_service,
    process_ncrp_upload,
    reconcile_ncrp_file_service,
    repair_ncrp_file_service,
    trace_ncrp_account_next_service,
    validate_ncrp_case_access,
    view_ncrp_file_service,
)

router = APIRouter(
    prefix="/api/v1/ncrp",
    tags=["NCRP Statement Management"],
)


@router.post(
    "/{case_id}/upload",
    response_model=NcrpUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and Import NCRP Statement Excel Workbook",
)
def upload_ncrp_statement_route(
    case_id: int,
    file: UploadFile = FastAPIFile(...),
    client_id: Optional[int] = Form(default=None),
    user_id: Optional[int] = Form(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload an NCRP Statement Excel file (.xlsx or .xls), dynamically discover all

    worksheets, parse transactions, and store them with their sheet name and row number.
    """
    return process_ncrp_upload(
        db=db,
        case_id=case_id,
        file=file,
        current_user=current_user,
        target_client_id=client_id,
        target_user_id=user_id,
    )


@router.get(
    "/case/{case_id}",
    response_model=List[NcrpFileResponse],
    summary="List all NCRP files uploaded for a case",
)
def get_case_ncrp_files_route(
    case_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retrieve all uploaded NCRP files for the given case."""
    return get_case_ncrp_files_service(
        db=db,
        case_id=case_id,
        user=current_user,
    )


@router.get(
    "/file/{file_id}",
    response_model=NcrpFileResponse,
    summary="Get NCRP file details and import counts by file ID",
)
def get_ncrp_file_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retrieve metadata and row counts for a specific NCRP file."""
    ncrp_file = get_ncrp_file_service(
        db=db,
        file_id=file_id,
        user=current_user,
    )
    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )
    return ncrp_file


@router.get(
    "/file/{file_id}/view",
    summary="Download or view the original uploaded NCRP Excel workbook",
)
def view_ncrp_file_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retrieve original uploaded NCRP Excel workbook with authorization and secure headers."""
    file_path, filename, media_type = view_ncrp_file_service(
        db=db,
        file_id=file_id,
        user=current_user,
        case_id=case_id,
    )
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
        content_disposition_type="attachment",
    )


@router.get(
    "/file/{file_id}/download",
    summary="Alias for downloading original uploaded NCRP Excel workbook",
)
def download_ncrp_file_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Alias route to view_ncrp_file_route for direct download requests."""
    return view_ncrp_file_route(
        file_id=file_id,
        case_id=case_id,
        db=db,
        current_user=current_user,
    )


@router.get(
    "/file/{file_id}/transactions",
    response_model=NcrpTransactionPaginatedResponse,
    summary="List transactions imported from an NCRP file with filtering, search, and pagination",
)
def get_ncrp_transactions_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    sheet_name: Optional[str] = Query(default=None, description="Filter by worksheet name"),
    search: Optional[str] = Query(default=None, description="Search across acknowledgement, account, UTR, bank name"),
    date_from: Optional[str] = Query(default=None, description="Filter from transaction date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(default=None, description="Filter to transaction date (YYYY-MM-DD)"),
    min_amount: Optional[float] = Query(default=None, description="Minimum transaction amount"),
    max_amount: Optional[float] = Query(default=None, description="Maximum transaction amount"),
    bank_name: Optional[str] = Query(default=None, description="Filter by bank name"),
    layer: Optional[str] = Query(default=None, description="Filter by layer"),
    acknowledgement_no: Optional[str] = Query(default=None, description="Filter by acknowledgement number"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=1000),
    sort_by: str = Query(default="row_number"),
    sort_order: str = Query(default="asc"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retrieve parsed transaction rows for an NCRP file with sheet filter, search, and pagination."""
    ncrp_file = get_ncrp_file_service(db=db, file_id=file_id, user=current_user)
    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )
    return get_ncrp_transactions_paginated(
        db=db,
        file_id=file_id,
        case_id=ncrp_file.case_id,
        sheet_name=sheet_name,
        search=search,
        date_from=date_from,
        date_to=date_to,
        min_amount=min_amount,
        max_amount=max_amount,
        bank_name=bank_name,
        layer=layer,
        acknowledgement_no=acknowledgement_no,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/file/{file_id}/sankey",
    response_model=NcrpSankeyResponse,
    summary="Get aggregated layer-wise Sankey nodes, links, and KPI metrics for an NCRP workbook",
)
def get_ncrp_sankey_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    layer: Optional[str] = Query(default=None, description="Filter by layer (e.g. 'Layer 1', 'Layer 2', or 'ALL')"),
    acknowledgement_no: Optional[str] = Query(default=None, description="Filter by acknowledgement number"),
    sheet_name: Optional[str] = Query(default=None, description="Filter by worksheet name"),
    bank_name: Optional[str] = Query(default=None, description="Filter by bank name"),
    search: Optional[str] = Query(default=None, description="Search across account, UTR, bank name"),
    date_from: Optional[str] = Query(default=None, description="Filter from transaction date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(default=None, description="Filter to transaction date (YYYY-MM-DD)"),
    min_amount: Optional[float] = Query(default=None, description="Minimum transaction amount"),
    max_amount: Optional[float] = Query(default=None, description="Maximum transaction amount"),
    money_transfer_only: bool = Query(default=False, description="Strictly restrict flow to Money Transfer to records"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retrieve layer-wise money flow Sankey visualization data and financial KPI metrics."""
    return get_ncrp_sankey_service(
        db=db,
        file_id=file_id,
        user=current_user,
        case_id=case_id,
        layer=layer,
        acknowledgement_no=acknowledgement_no,
        sheet_name=sheet_name,
        bank_name=bank_name,
        search=search,
        date_from=date_from,
        date_to=date_to,
        min_amount=min_amount,
        max_amount=max_amount,
        money_transfer_only=money_transfer_only,
    )


@router.delete(
    "/file/{file_id}",
    summary="Delete an NCRP file and its imported transactions",
)
def delete_ncrp_file_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delete an NCRP file, its cascaded database transactions, and its physical storage file."""
    return delete_ncrp_file_service(
        db=db,
        file_id=file_id,
        user=current_user,
        case_id=case_id,
    )


@router.get(
    "/file/{file_id}/reconcile",
    response_model=NcrpReconcileResponse,
    summary="Dry-run audit and reconciliation report for an NCRP file",
)
def reconcile_ncrp_file_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Perform dry-run reconciliation comparing source workbook against current DB records."""
    return reconcile_ncrp_file_service(
        db=db,
        file_id=file_id,
        user=current_user,
        case_id=case_id,
    )


@router.post(
    "/file/{file_id}/repair",
    response_model=NcrpReconcileResponse,
    summary="Safely execute repair and synchronization for an NCRP file",
)
def repair_ncrp_file_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Atomically repair and re-synchronize transactions for the specified NCRP file."""
    return repair_ncrp_file_service(
        db=db,
        file_id=file_id,
        user=current_user,
        case_id=case_id,
    )


@router.get(
    "/file/{file_id}/activity-breakdown",
    response_model=NcrpLayerActivityResponse,
    summary="Get layer activity breakdown across all worksheets without double-counting",
)
def get_ncrp_layer_activity_route(
    file_id: int,
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    layer: Optional[str] = Query(default=None, description="Filter by layer"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retrieve worksheet-aware breakdown and non-overlapping KPIs for a layer or overall."""
    return get_ncrp_layer_activity_service(
        db=db,
        file_id=file_id,
        user=current_user,
        case_id=case_id,
        layer=layer,
    )


@router.get(
    "/file/{file_id}/account-profile",
    response_model=NcrpAccountProfileResponse,
    summary="Get 360-degree account profile across transfers, withdrawals, and holds",
)
def get_ncrp_account_profile_route(
    file_id: int,
    account: str = Query(..., description="Account or Wallet ID to inspect"),
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    layer: Optional[str] = Query(default=None, description="Optional layer filter"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retrieve full consolidated account view showing incoming, outgoing, withdrawals, holds, counterparties, and records."""
    return get_ncrp_account_profile_service(
        db=db,
        file_id=file_id,
        account=account,
        user=current_user,
        case_id=case_id,
        layer=layer,
    )


@router.get(
    "/file/{file_id}/trace-next",
    response_model=NcrpTraceNextResponse,
    summary="Trace account activity into subsequent higher layers",
)
def trace_ncrp_account_next_route(
    file_id: int,
    account: str = Query(..., description="Account number to trace forward"),
    current_layer: int = Query(default=1, ge=1, description="Current layer number"),
    case_id: Optional[int] = Query(default=None, description="Optional case validation"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Detect whether account has forward activity in higher layers and return immediate next layer and records."""
    return trace_ncrp_account_next_service(
        db=db,
        file_id=file_id,
        account=account,
        current_layer=current_layer,
        user=current_user,
        case_id=case_id,
    )



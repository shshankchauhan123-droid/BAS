from datetime import datetime, timezone
import os
from pathlib import Path
import uuid
from typing import List, Tuple, Optional, Dict, Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.case.case_repository import get_case_by_id, get_case_by_id_and_user
from app.core.roles import ADMIN_ROLE, CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.ncrp.ncrp_parser import parse_ncrp_workbook, NcrpParseResult
from app.ncrp.ncrp_repository import (
    create_ncrp_file,
    delete_ncrp_file,
    get_ncrp_account_profile_data,
    get_ncrp_file_by_id,
    get_ncrp_files_by_case,
    get_ncrp_hierarchical_graph_data,
    get_ncrp_layer1_sources,
    get_ncrp_layer_activity_breakdown,

    get_ncrp_sankey_data,
    get_ncrp_transactions_by_file,
    repair_ncrp_file_transactions,
    trace_ncrp_account_forward,
    get_ncrp_edge_transactions,
    get_ncrp_sender_receivers,
)
from app.ncrp.ncrp_schema import NcrpUploadResponse, SheetSummaryResponse
from app.user.user_model import User


NCRP_STORAGE_ROOT = Path("storage") / "ncrp"
ALLOWED_EXTENSIONS = {".xlsx", ".xls"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def create_ncrp_storage_directory(case_id: int) -> Path:
    """Ensure dedicated storage directory exists: storage/ncrp/{case_id}/"""
    directory = NCRP_STORAGE_ROOT / str(case_id)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def validate_ncrp_case_access(
    db: Session,
    case_id: int,
    user: User,
    target_client_id: Optional[int] = None,
    target_user_id: Optional[int] = None,
    require_reports: bool = False,
):
    """Validate user access to the case using established role hierarchy and scoping."""
    user_role = str(getattr(user, "role", "")).lower()

    if user_role in {ADMIN_ROLE, SUPERADMIN_ROLE, "admin", "superadmin"}:
        case = get_case_by_id(db=db, case_id=case_id)
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Investigation case with ID {case_id} not found.",
            )
        if target_client_id is not None:
            case_client = case.client_id or (case.creator.client_id if case.creator else None)
            if case_client != target_client_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The selected case does not belong to the selected client.",
                )
        if target_user_id is not None:
            if case.created_by != target_user_id and case.assigned_to != target_user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The selected case does not belong to the selected user.",
                )
        if target_client_id is not None and target_user_id is not None:
            from app.user.user_repository import get_user_by_id as repo_get_user
            t_user = repo_get_user(db=db, user_id=target_user_id)
            if not t_user or t_user.client_id != target_client_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The selected user does not belong to the selected client.",
                )

    elif user_role in {CLIENT_ADMIN_ROLE, "client_admin"}:
        case = get_case_by_id(db=db, case_id=case_id)
        if not case or not (
            case.client_id == user.client_id
            or (case.creator and case.creator.client_id == user.client_id)
            or (case.assignee and case.assignee.client_id == user.client_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access cases for another client organization.",
            )
        if target_user_id is not None:
            if case.created_by != target_user_id and case.assigned_to != target_user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The selected case does not belong to the selected user.",
                )
    else:
        perms = getattr(user, "permissions", None)
        if not perms or not getattr(perms, "can_ncrp_statement_analysis", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission for NCRP Statement Analysis. Contact your company administrator.",
            )
        if require_reports and getattr(perms, "can_view_reports", True) is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view reports.",
            )
        case = get_case_by_id_and_user(db=db, case_id=case_id, user_id=user.id)
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Investigation case with ID {case_id} not found or access denied.",
            )

    return case


def validate_ncrp_upload_file(file: UploadFile) -> str:
    """Validate filename and extension."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required for NCRP Statement upload.",
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{ext or 'unknown'}'. "
                "NCRP Statement uploads only accept .xlsx and .xls Excel workbooks."
            ),
        )
    return ext


def save_ncrp_uploaded_file(file: UploadFile, case_id: int, ext: str) -> Tuple[Path, str, int]:
    """Save uploaded stream to dedicated storage location with unique filename."""
    case_dir = create_ncrp_storage_directory(case_id)
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = case_dir / stored_filename

    file_size = 0
    try:
        with open(target_path, "wb") as out_file:
            while True:
                chunk = file.file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    out_file.close()
                    if target_path.exists():
                        target_path.unlink()
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)} MB.",
                    )
                out_file.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write uploaded file to disk: {str(e)}",
        )

    return target_path, stored_filename, file_size


def process_ncrp_upload(
    db: Session,
    case_id: int,
    file: UploadFile,
    current_user: User,
    target_client_id: Optional[int] = None,
    target_user_id: Optional[int] = None,
) -> NcrpUploadResponse:
    """Full workflow: validate case & file, save to storage, parse all worksheets,

    atomically insert transactions, and update file record.
    """
    # 1. Validate case access
    case = validate_ncrp_case_access(
        db=db,
        case_id=case_id,
        user=current_user,
        target_client_id=target_client_id,
        target_user_id=target_user_id,
    )

    user_role = str(getattr(current_user, "role", "")).lower()
    if user_role not in {ADMIN_ROLE, SUPERADMIN_ROLE, CLIENT_ADMIN_ROLE, "admin", "superadmin", "client_admin"}:
        perms = getattr(current_user, "permissions", None)
        if perms and getattr(perms, "can_upload_files", True) is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to upload files. Contact your company administrator.",
            )

    # 2. Validate file format
    ext = validate_ncrp_upload_file(file)

    # 3. Save physical file to disk
    file_path, stored_filename, file_size = save_ncrp_uploaded_file(file, case_id, ext)

    # 4. Check for duplicate pending upload
    existing_pending = (
        db.query(NcrpFile)
        .filter(
            NcrpFile.case_id == case_id,
            NcrpFile.original_filename == file.filename,
            NcrpFile.file_size == file_size,
            NcrpFile.status == "PROCESSING",
        )
        .first()
    )
    if existing_pending:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An identical NCRP file is currently being processed. Please wait for it to finish.",
        )

    # 5. Create ncrp_file metadata record in PROCESSING state
    ncrp_file = NcrpFile(
        case_id=case_id,
        created_by=current_user.id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=str(file_path),
        mime_type=file.content_type,
        file_size=file_size,
        status="PROCESSING",
        sheet_count=0,
        total_rows=0,
        imported_rows=0,
        failed_rows=0,
    )
    db.add(ncrp_file)
    db.commit()
    db.refresh(ncrp_file)

    # 6. Parse workbook worksheets
    try:
        parse_result: NcrpParseResult = parse_ncrp_workbook(file_path)
    except Exception as e:
        ncrp_file.status = "FAILED"
        ncrp_file.error_message = f"Failed to parse Excel workbook: {str(e)}"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to read NCRP Excel workbook: {str(e)}",
        )

    # 7. Atomically insert transactions and update file metadata
    try:
        # Prevent any duplicate rows on retry
        db.query(NcrpTransaction).filter(
            NcrpTransaction.ncrp_file_id == ncrp_file.id
        ).delete(synchronize_session=False)

        transactions: List[NcrpTransaction] = []
        for r in parse_result.rows:
            transactions.append(
                NcrpTransaction(
                    ncrp_file_id=ncrp_file.id,
                    case_id=case_id,
                    sheet_name=r.sheet_name,
                    row_number=r.row_number,
                    acknowledgement_no=r.acknowledgement_no,
                    account_or_wallet_id=r.account_or_wallet_id,
                    transaction_id_utr=r.transaction_id_utr,
                    transaction_date=r.transaction_date,
                    transaction_amount=r.transaction_amount,
                    disputed_amount=r.disputed_amount,
                    bank_name=r.bank_name,
                    layer=r.layer,
                    raw_data=r.raw_data,
                )
            )

        # Batch insert
        BATCH_SIZE = 1000
        for i in range(0, len(transactions), BATCH_SIZE):
            chunk = transactions[i : i + BATCH_SIZE]
            db.bulk_save_objects(chunk)
            db.flush()

        # Update ncrp_file record
        ncrp_file.sheet_count = parse_result.sheet_count
        ncrp_file.total_rows = parse_result.total_rows
        ncrp_file.imported_rows = parse_result.imported_rows
        ncrp_file.failed_rows = parse_result.failed_rows
        ncrp_file.status = "COMPLETED"
        ncrp_file.error_message = None
        ncrp_file.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(ncrp_file)

    except Exception as e:
        db.rollback()
        try:
            ncrp_file.status = "FAILED"
            ncrp_file.error_message = f"Database insertion failed: {str(e)}"
            ncrp_file.updated_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import NCRP transactions: {str(e)}",
        )

    # 8. Return response
    sheets_summary_resp = [
        SheetSummaryResponse(
            sheet_name=s.sheet_name,
            total_rows=s.total_rows,
            imported_rows=s.imported_rows,
            failed_rows=s.failed_rows,
        )
        for s in parse_result.sheets_summary
    ]

    return NcrpUploadResponse(
        id=ncrp_file.id,
        case_id=ncrp_file.case_id,
        original_filename=ncrp_file.original_filename,
        stored_filename=ncrp_file.stored_filename,
        file_size=ncrp_file.file_size,
        sheet_count=ncrp_file.sheet_count,
        total_rows=ncrp_file.total_rows,
        imported_rows=ncrp_file.imported_rows,
        failed_rows=ncrp_file.failed_rows,
        status=ncrp_file.status,
        error_message=ncrp_file.error_message,
        created_at=ncrp_file.created_at,
        sheets_summary=sheets_summary_resp,
        message=f"Successfully imported {ncrp_file.imported_rows} transactions across {ncrp_file.sheet_count} worksheets.",
    )


def reconcile_ncrp_file_service(
    db: Session, file_id: int, user: User, case_id: Optional[int] = None
) -> dict:
    """Perform dry-run reconciliation comparing source workbook rows against current database rows.

    Generates detailed field-by-field differences without modifying the database.
    """
    ncrp_file = get_ncrp_file_by_id(db, file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user)

    file_path = Path(ncrp_file.file_path)
    if not file_path.exists():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        if (backend_dir / ncrp_file.file_path).exists():
            file_path = backend_dir / ncrp_file.file_path
        elif (backend_dir.parent / ncrp_file.file_path).exists():
            file_path = backend_dir.parent / ncrp_file.file_path

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source NCRP Excel workbook file was not found on server storage.",
        )

    parse_result: NcrpParseResult = parse_ncrp_workbook(file_path)

    db_rows = (
        db.query(NcrpTransaction)
        .filter(
            NcrpTransaction.ncrp_file_id == file_id,
            NcrpTransaction.case_id == ncrp_file.case_id,
        )
        .order_by(NcrpTransaction.sheet_name.asc(), NcrpTransaction.row_number.asc())
        .all()
    )

    db_map = {(r.sheet_name, r.row_number): r for r in db_rows}
    discrepancies: List[Dict[str, Any]] = []

    for r in parse_result.rows:
        db_row = db_map.get((r.sheet_name, r.row_number))
        if not db_row:
            discrepancies.append({
                "tx_id": None,
                "sheet": r.sheet_name,
                "row": r.row_number,
                "diffs": {"row": {"db": "MISSING", "expected": "PRESENT", "reason": "Missing from database"}},
            })
            continue

        diffs = {}
        if db_row.bank_name != r.bank_name:
            diffs["bank_name"] = {
                "db": db_row.bank_name,
                "expected": r.bank_name,
                "reason": "Missing Bank/FIs recognition in previous parser" if r.bank_name else "Bank/FIs absent",
            }

        if db_row.transaction_date != r.transaction_date:
            diffs["transaction_date"] = {
                "db": db_row.transaction_date.isoformat() if db_row.transaction_date else None,
                "expected": r.transaction_date.isoformat() if r.transaction_date else None,
                "reason": "Malformed AM/PM in source time or hold date excluded in previous parser",
            }

        if db_row.transaction_amount != r.transaction_amount:
            diffs["transaction_amount"] = {
                "db": str(db_row.transaction_amount) if db_row.transaction_amount is not None else None,
                "expected": str(r.transaction_amount) if r.transaction_amount is not None else None,
                "reason": "Amount parsing discrepancy",
            }

        if db_row.disputed_amount != r.disputed_amount:
            diffs["disputed_amount"] = {
                "db": str(db_row.disputed_amount) if db_row.disputed_amount is not None else None,
                "expected": str(r.disputed_amount) if r.disputed_amount is not None else None,
                "reason": "Put on hold date mistakenly parsed into disputed amount" if "hold" in r.sheet_name.lower() else "Disputed amount discrepancy",
            }

        if db_row.transaction_id_utr != r.transaction_id_utr:
            diffs["transaction_id_utr"] = {
                "db": db_row.transaction_id_utr,
                "expected": r.transaction_id_utr,
                "reason": "Source UTR vs Transfer UTR discrepancy",
            }

        if diffs:
            discrepancies.append({
                "tx_id": db_row.id,
                "sheet": r.sheet_name,
                "row": r.row_number,
                "diffs": diffs,
            })

    return {
        "file_id": file_id,
        "case_id": ncrp_file.case_id,
        "original_filename": ncrp_file.original_filename,
        "dry_run": True,
        "total_source_rows": parse_result.total_rows,
        "total_db_rows": len(db_rows),
        "discrepancies_count": len(discrepancies),
        "discrepancies": discrepancies,
        "repaired": False,
        "message": f"Dry-run comparison completed. Found {len(discrepancies)} discrepant rows out of {len(db_rows)} stored records.",
    }


def repair_ncrp_file_service(
    db: Session, file_id: int, user: User, case_id: Optional[int] = None
) -> dict:
    """Safely and atomically repair transactions for an NCRP file.

    1. Validates user case access.
    2. Re-parses original source workbook.
    3. Atomically replaces existing transactions for (file_id, case_id) within a single transaction.
    4. Updates ncrp_file counts and timestamp.
    5. Rolls back on any error.
    """
    ncrp_file = get_ncrp_file_by_id(db, file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user)

    file_path = Path(ncrp_file.file_path)
    if not file_path.exists():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        if (backend_dir / ncrp_file.file_path).exists():
            file_path = backend_dir / ncrp_file.file_path
        elif (backend_dir.parent / ncrp_file.file_path).exists():
            file_path = backend_dir.parent / ncrp_file.file_path

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source NCRP Excel workbook file was not found on server storage.",
        )

    try:
        parse_result: NcrpParseResult = parse_ncrp_workbook(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to re-parse NCRP workbook: {str(e)}",
        )

    try:
        new_transactions: List[NcrpTransaction] = [
            NcrpTransaction(
                ncrp_file_id=ncrp_file.id,
                case_id=ncrp_file.case_id,
                sheet_name=r.sheet_name,
                row_number=r.row_number,
                acknowledgement_no=r.acknowledgement_no,
                account_or_wallet_id=r.account_or_wallet_id,
                transaction_id_utr=r.transaction_id_utr,
                transaction_date=r.transaction_date,
                transaction_amount=r.transaction_amount,
                disputed_amount=r.disputed_amount,
                bank_name=r.bank_name,
                layer=r.layer,
                raw_data=r.raw_data,
            )
            for r in parse_result.rows
        ]

        inserted_count = repair_ncrp_file_transactions(
            db=db,
            file_id=ncrp_file.id,
            case_id=ncrp_file.case_id,
            new_transactions=new_transactions,
        )

        ncrp_file.sheet_count = parse_result.sheet_count
        ncrp_file.total_rows = parse_result.total_rows
        ncrp_file.imported_rows = parse_result.imported_rows
        ncrp_file.failed_rows = parse_result.failed_rows
        ncrp_file.status = "COMPLETED"
        ncrp_file.error_message = None
        ncrp_file.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(ncrp_file)

        return {
            "file_id": ncrp_file.id,
            "case_id": ncrp_file.case_id,
            "original_filename": ncrp_file.original_filename,
            "dry_run": False,
            "total_source_rows": parse_result.total_rows,
            "total_db_rows": inserted_count,
            "discrepancies_count": 0,
            "discrepancies": [],
            "repaired": True,
            "message": f"Successfully repaired and synchronized {inserted_count} transactions across {parse_result.sheet_count} worksheets for file ID {ncrp_file.id}.",
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transaction repair failed and was safely rolled back: {str(e)}",
        )


def get_case_ncrp_files_service(db: Session, case_id: int, user: User) -> List[NcrpFile]:
    """List all NCRP files for a case after verifying user access."""
    validate_ncrp_case_access(db, case_id, user)
    return get_ncrp_files_by_case(db, case_id)


def get_ncrp_file_service(db: Session, file_id: int, user: User) -> NcrpFile:
    """Get single NCRP file after verifying user access."""
    ncrp_file = get_ncrp_file_by_id(db, file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )
    validate_ncrp_case_access(db, ncrp_file.case_id, user)
    return ncrp_file


def view_ncrp_file_service(
    db: Session, file_id: int, user: User, case_id: Optional[int] = None
) -> Tuple[Path, str, str]:
    """Retrieve original NCRP Excel workbook path, filename, and media type after authorization."""
    ncrp_file = get_ncrp_file_by_id(db, file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to the specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user)

    file_path = Path(ncrp_file.file_path)
    if not file_path.exists():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        if (backend_dir / ncrp_file.file_path).exists():
            file_path = backend_dir / ncrp_file.file_path
        elif (backend_dir.parent / ncrp_file.file_path).exists():
            file_path = backend_dir.parent / ncrp_file.file_path

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested NCRP Excel workbook file was not found on the server storage.",
        )

    media_type = ncrp_file.mime_type
    if not media_type or media_type == "application/octet-stream":
        ext = file_path.suffix.lower()
        if ext == ".xlsx":
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif ext == ".xls":
            media_type = "application/vnd.ms-excel"
        else:
            media_type = "application/octet-stream"

    return file_path, ncrp_file.original_filename, media_type


def delete_ncrp_file_service(
    db: Session, file_id: int, user: User, case_id: Optional[int] = None
) -> dict:
    """Delete NCRP file, cascading transactions and removing physical file from storage."""
    user_role = str(getattr(user, "role", "")).lower()
    if user_role not in {ADMIN_ROLE, SUPERADMIN_ROLE, CLIENT_ADMIN_ROLE, "admin", "superadmin", "client_admin"}:
        perms = getattr(user, "permissions", None)
        if perms and getattr(perms, "can_delete_files", True) is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete files. Contact your company administrator.",
            )

    ncrp_file = get_ncrp_file_by_id(db, file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to the specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user)

    file_deleted = False
    file_path_str = ncrp_file.file_path
    if file_path_str:
        p = Path(file_path_str)
        if not p.exists():
            backend_dir = Path(__file__).resolve().parent.parent.parent
            if (backend_dir / file_path_str).exists():
                p = backend_dir / file_path_str
            elif (backend_dir.parent / file_path_str).exists():
                p = backend_dir.parent / file_path_str
        if p.exists() and p.is_file():
            try:
                p.unlink()
                file_deleted = True
            except Exception as e:
                print(f"Warning: could not delete physical NCRP file {p}: {e}")

    deleted = delete_ncrp_file(db, file_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete NCRP file record from database.",
        )

    return {
        "success": True,
        "message": f"NCRP file '{ncrp_file.original_filename}' and its imported transactions have been deleted successfully.",
        "file_deleted": file_deleted,
    }


def get_ncrp_sankey_service(
    db: Session,
    file_id: int,
    user: User,
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
    """Retrieve layer-wise Sankey nodes, links, and KPI metrics with access control."""
    ncrp_file = get_ncrp_file_by_id(db=db, file_id=file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user, require_reports=True)

    return get_ncrp_sankey_data(
        db=db,
        file_id=file_id,
        case_id=ncrp_file.case_id,
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


def get_ncrp_layer_activity_service(
    db: Session,
    file_id: int,
    user: User,
    case_id: Optional[int] = None,
    layer: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve layer activity breakdown across all worksheets with access control."""
    ncrp_file = get_ncrp_file_by_id(db=db, file_id=file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user, require_reports=True)

    return get_ncrp_layer_activity_breakdown(
        db=db,
        file_id=file_id,
        case_id=ncrp_file.case_id,
        layer=layer,
    )


def get_ncrp_account_profile_service(
    db: Session,
    file_id: int,
    account: str,
    user: User,
    case_id: Optional[int] = None,
    layer: Optional[str] = None,
    money_transfer_only: bool = False,
    root_account: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve complete 360-degree account profile across worksheets with access control."""
    ncrp_file = get_ncrp_file_by_id(db=db, file_id=file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user, require_reports=True)

    return get_ncrp_account_profile_data(
        db=db,
        file_id=file_id,
        account=account,
        case_id=ncrp_file.case_id,
        layer=layer,
        money_transfer_only=money_transfer_only,
        root_account=root_account,
    )


def trace_ncrp_account_next_service(
    db: Session,
    file_id: int,
    account: str,
    current_layer: int,
    user: User,
    case_id: Optional[int] = None,
    money_transfer_only: bool = False,
) -> Dict[str, Any]:
    """Trace forward subsequent layer transactions for an account with access control."""
    ncrp_file = get_ncrp_file_by_id(db=db, file_id=file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user, require_reports=True)

    return trace_ncrp_account_forward(
        db=db,
        file_id=file_id,
        account=account,
        current_layer=current_layer,
        case_id=ncrp_file.case_id,
        money_transfer_only=money_transfer_only,
    )


def get_ncrp_layer1_sources_service(
    db: Session,
    file_id: int,
    user: User,
    case_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Retrieve all distinct Layer 1 source accounts with access control."""
    ncrp_file = get_ncrp_file_by_id(db=db, file_id=file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user, require_reports=True)

    return get_ncrp_layer1_sources(
        db=db,
        file_id=file_id,
        case_id=ncrp_file.case_id,
    )


def get_ncrp_hierarchical_graph_service(
    db: Session,
    file_id: int,
    user: User,
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
    """Retrieve hierarchical DAG money flow graph data with access control."""
    ncrp_file = get_ncrp_file_by_id(db=db, file_id=file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user, require_reports=True)

    return get_ncrp_hierarchical_graph_data(
        db=db,
        file_id=file_id,
        case_id=ncrp_file.case_id,
        root_account=root_account,
        expand_account=expand_account,
        expand_all=expand_all,
        expanded_accounts=expanded_accounts,
        search=search,
        bank_name=bank_name,
        layer=layer,
        min_amount=min_amount,
        max_amount=max_amount,
        date_from=date_from,
        date_to=date_to,
    )


def get_ncrp_edge_transactions_service(
    db: Session,
    file_id: int,
    source_account: str,
    target_account: str,
    user: User,
    layer: Optional[int] = None,
    case_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Retrieve individual Money Transfer To transactions for an aggregated edge with access control."""
    ncrp_file = get_ncrp_file_by_id(db=db, file_id=file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user, require_reports=True)

    return get_ncrp_edge_transactions(
        db=db,
        file_id=file_id,
        source_account=source_account,
        target_account=target_account,
        layer=layer,
        case_id=ncrp_file.case_id,
    )


def get_ncrp_sender_receivers_service(
    db: Session,
    file_id: int,
    sender_account: str,
    user: User,
    layer: Optional[int] = None,
    case_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Retrieve all distinct receivers for a sender from Money Transfer To worksheet with access control."""
    ncrp_file = get_ncrp_file_by_id(db=db, file_id=file_id)
    if not ncrp_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCRP file with ID {file_id} not found.",
        )

    if case_id is not None and ncrp_file.case_id != case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NCRP file does not belong to specified case.",
        )

    validate_ncrp_case_access(db, ncrp_file.case_id, user, require_reports=True)

    return get_ncrp_sender_receivers(
        db=db,
        file_id=file_id,
        sender_account=sender_account,
        layer=layer,
        case_id=ncrp_file.case_id,
    )



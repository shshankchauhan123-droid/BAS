from datetime import date, datetime
import os
from pathlib import Path
import re
import uuid

from fastapi import UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit.audit_service import record_audit_log
from app.bank_transactions.bank_transaction_model import BankTransaction
from app.case.case_repository import get_case_by_id, get_case_by_id_and_user
from app.core.roles import ADMIN_ROLE, CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE, USER_ROLE
from app.files.file_model import File, MergedFileSource
from app.files.file_repository import (
    _normalize_to_date,
    create_file,
    delete_file,
    get_all_cascade_source_files_for_merged,
    get_file_by_id,
    get_file_by_id_and_user,
    get_files_by_case,
    get_files_by_case_and_user,
    get_leaf_source_files_for_merged,
    get_leaf_source_file_ids_for_merged,
    get_merged_file_by_sources,
    get_source_files_for_merged,
    get_source_file_ids_for_merged,
)
from app.files.file_schema import FileUpdateRequest, MergeFilesRequest
from app.tasks.bank_statement_task import process_bank_statement
from app.user.user_model import User


UPLOAD_ROOT = Path("storage")

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".csv",
    ".xlsx",
    ".xls",
    ".txt",
    ".doc",
    ".docx",
}

MAX_FILE_SIZE = 100 * 1024 * 1024


# ============================================================
# FILE EXTENSION
# ============================================================

def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


# ============================================================
# FILE VALIDATION
# ============================================================

def validate_file(file: UploadFile) -> None:
    if not file.filename:
        raise ValueError("File name is required")

    extension = get_file_extension(file.filename)

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type: "
            f"{extension or 'unknown'}"
        )


# ============================================================
# CREATE STORAGE DIRECTORY
# ============================================================

def create_storage_directory(
    case_id: int,
) -> Path:

    case_directory = (
        UPLOAD_ROOT
        / "cases"
        / str(case_id)
    )

    case_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    return case_directory


# ============================================================
# SAVE UPLOADED FILE
# ============================================================

def save_uploaded_file(
    file: UploadFile,
    case_id: int,
) -> tuple[str, int]:

    
    case_directory = create_storage_directory(
        case_id
    )

    extension = get_file_extension(
        file.filename
    )

    stored_filename = (
        f"{uuid.uuid4().hex}{extension}"
    )

    file_path = (
        case_directory
        / stored_filename
    )

    file_size = 0

    try:

        with open(
            file_path,
            "wb",
        ) as output_file:

            while True:

                chunk = file.file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                file_size += len(chunk)

                if file_size > MAX_FILE_SIZE:

                    output_file.close()

                    if file_path.exists():
                        file_path.unlink()

                    raise ValueError(
                        "File size exceeds the maximum "
                        "allowed size of 100 MB"
                    )

                output_file.write(chunk)

    except Exception:

        if file_path.exists():
            file_path.unlink()

        raise

    return str(file_path), file_size


# ============================================================
# UPLOAD FILE
# ============================================================

def upload_file(
    db: Session,
    file: UploadFile,
    case_id: int,
    user: User,
    document_type: str = "BANK_STATEMENT",
) -> File:
    user_id = user.id
    user_role = str(user.role).lower()
    if user_role == USER_ROLE:
        perms = getattr(user, "permissions", None)
        if perms and not perms.can_upload_files:
            raise PermissionError("You do not have permission to upload files. Contact your company administrator.")

    # --------------------------------------------------------
    # Check case ownership
    # --------------------------------------------------------
    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        case = get_case_by_id(db=db, case_id=case_id)
    elif user_role == CLIENT_ADMIN_ROLE:
        case = get_case_by_id(db=db, case_id=case_id)
        if not case or not (
            case.client_id == user.client_id
            or (case.creator and case.creator.client_id == user.client_id)
            or (case.assignee and case.assignee.client_id == user.client_id)
        ):
            case = None
    else:
        case = get_case_by_id_and_user(
            db=db,
            case_id=case_id,
            user_id=user_id,
        )

    if not case:
        raise ValueError(
            "Case not found"
        )

    # --------------------------------------------------------
    # Validate file
    # --------------------------------------------------------

    validate_file(file)

    # --------------------------------------------------------
    # Save physical file
    # --------------------------------------------------------

    file_path, file_size = save_uploaded_file(
        file=file,
        case_id=case_id,
    )

    stored_filename = os.path.basename(
        file_path
    )

    # --------------------------------------------------------
    # Create database record
    # --------------------------------------------------------

    valid_doc_type = (document_type or "BANK_STATEMENT").strip().upper()
    if valid_doc_type not in {"BANK_STATEMENT", "UNKNOWN"}:
        valid_doc_type = "BANK_STATEMENT"

    new_file = File(
        case_id=case_id,
        created_by=user_id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=file_path,
        mime_type=file.content_type,
        file_size=file_size,
        document_type=valid_doc_type,
        status="QUEUED",
    )

    try:

        # ----------------------------------------------------
        # Save file record in PostgreSQL
        # ----------------------------------------------------

        created_file = create_file(
            db=db,
            file=new_file,
        )

        # ----------------------------------------------------
        # Send file ID to Celery / RabbitMQ
        # ----------------------------------------------------

        process_bank_statement.delay(
            created_file.id
        )

        record_audit_log(
            db=db,
            actor=user,
            action="FILE_UPLOADED",
            entity_type="file",
            entity_id=str(created_file.id),
            entity_name=created_file.original_filename,
            description=f"User {user.username} uploaded file '{created_file.original_filename}' to Case #{case.case_number}",
            details={
                "file_name": created_file.original_filename,
                "file_size": created_file.file_size,
                "mime_type": created_file.mime_type,
                "case_id": case.id,
                "case_number": case.case_number,
            },
            client_id=case.client_id,
        )

        print(
            "=" * 60
        )
        print(
            "FILE ADDED TO PROCESSING QUEUE"
        )
        print(
            f"FILE ID       : {created_file.id}"
        )
        print(
            f"FILE NAME     : {created_file.original_filename}"
        )
        print(
            f"FILE PATH     : {created_file.file_path}"
        )
        print(
            "STATUS        : QUEUED"
        )
        print(
            "=" * 60
        )

    except Exception as error:

        # ----------------------------------------------------
        # If database record was created but queue failed
        # ----------------------------------------------------

        try:
            db.rollback()
        except Exception:
            pass

        # ----------------------------------------------------
        # Delete physical file
        # ----------------------------------------------------

        physical_file = Path(
            file_path
        )

        if physical_file.exists():
            physical_file.unlink()

        print(
            "ERROR: Failed to queue file:",
            error,
        )

        raise

    return created_file


# ============================================================
# GET CASE FILES
# ============================================================

def get_case_files(
    db: Session,
    case_id: int,
    user: User,
    include_superseded: bool = False,
    document_type: str | None = None,
) -> list[File]:

    user_id = user.id
    user_role = str(user.role).lower()

    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        case = get_case_by_id(db=db, case_id=case_id)
        if not case:
            raise ValueError("Case not found")
        return get_files_by_case(
            db=db,
            case_id=case_id,
            include_superseded=include_superseded,
            document_type=document_type,
        )
    elif user_role == CLIENT_ADMIN_ROLE:
        case = get_case_by_id(db=db, case_id=case_id)
        if not case or not (
            case.client_id == user.client_id
            or (case.creator and case.creator.client_id == user.client_id)
            or (case.assignee and case.assignee.client_id == user.client_id)
        ):
            raise ValueError("Case not found or permission denied")
        if case.client_id is None and user.client_id is not None:
            case.client_id = user.client_id
            try:
                db.commit()
            except Exception:
                db.rollback()
        return get_files_by_case(
            db=db,
            case_id=case_id,
            include_superseded=include_superseded,
            document_type=document_type,
        )
    else:
        case = get_case_by_id_and_user(
            db=db,
            case_id=case_id,
            user_id=user_id,
        )
        if not case:
            raise ValueError("Case not found")
        return get_files_by_case_and_user(
            db=db,
            case_id=case_id,
            user_id=user_id,
            include_superseded=include_superseded,
            document_type=document_type,
        )


# ============================================================
# GET SINGLE FILE FOR VIEW
# ============================================================

def get_file_for_view(
    db: Session,
    file_id: int,
    user: User,
) -> File:

    user_id = user.id
    user_role = str(user.role).lower()

    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        file = get_file_by_id(db=db, file_id=file_id)
    elif user_role == CLIENT_ADMIN_ROLE:
        file = get_file_by_id(db=db, file_id=file_id)
        if file:
            case = get_case_by_id(db=db, case_id=file.case_id)
            if not case or not (
                case.client_id == user.client_id
                or (case.creator and case.creator.client_id == user.client_id)
                or (case.assignee and case.assignee.client_id == user.client_id)
            ):
                file = None
    else:
        file = get_file_by_id_and_user(
            db=db,
            file_id=file_id,
            user_id=user_id,
        )
        if not file:
            f_candidate = get_file_by_id(db=db, file_id=file_id)
            if f_candidate:
                case = get_case_by_id_and_user(db=db, case_id=f_candidate.case_id, user_id=user_id)
                if case:
                    file = f_candidate

    if not file:
        raise ValueError(
            "File not found"
        )

    # --------------------------------------------------------
    # Check physical file
    # --------------------------------------------------------

    physical_file = Path(
        file.file_path
    )

    if not physical_file.exists():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        if (backend_dir / file.file_path).exists():
            physical_file = backend_dir / file.file_path

    if not physical_file.exists():
        raise ValueError(
            "Physical file not found"
        )

    if not physical_file.is_file():
        raise ValueError(
            "Stored path is not a file"
        )

    return file




def update_uploaded_file(
    db: Session,
    file_id: int,
    user: User,
    data: FileUpdateRequest,
) -> File:
    user_id = user.id
    user_role = str(user.role).lower()
    if user_role == "user":
        perms = getattr(user, "permissions", None)
        if perms and not perms.can_upload_files:
            raise PermissionError("You do not have permission to update files. Contact your company administrator.")

    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        file = get_file_by_id(db=db, file_id=file_id)
    elif user_role == CLIENT_ADMIN_ROLE:
        file = get_file_by_id(db=db, file_id=file_id)
        if file:
            case = get_case_by_id(db=db, case_id=file.case_id)
            if not case or not (
                case.client_id == user.client_id
                or (case.creator and case.creator.client_id == user.client_id)
                or (case.assignee and case.assignee.client_id == user.client_id)
            ):
                file = None
    else:
        file = get_file_by_id_and_user(
            db=db,
            file_id=file_id,
            user_id=user_id,
        )

    if not file:
        raise ValueError("File not found")

    details = {}
    
    if data.original_filename is not None and data.original_filename.strip():
        details["old_filename"] = file.original_filename
        file.original_filename = data.original_filename.strip()
        details["new_filename"] = file.original_filename

    update_fields = [
        'account_name', 'account_number', 'bank_name', 'branch_name', 
        'ifsc', 'micr', 'account_type', 'statement_start_date', 'statement_end_date'
    ]
    
    sync_account_name = False
    sync_account_number = False

    for field in update_fields:
        val = getattr(data, field)
        if val is not None:
            if isinstance(val, str):
                val = val.strip()
            old_val = getattr(file, field)
            if old_val != val:
                setattr(file, field, val)
                details[f"old_{field}"] = old_val
                details[f"new_{field}"] = val
                
                if field == 'account_name':
                    sync_account_name = True
                if field == 'account_number':
                    sync_account_number = True

    if sync_account_name or sync_account_number:
        # Perform bulk update on bank_transactions
        update_stmt = {}
        if sync_account_name:
            update_stmt[BankTransaction.account_name] = file.account_name
        if sync_account_number:
            update_stmt[BankTransaction.account_number] = file.account_number
            
        db.query(BankTransaction).filter(BankTransaction.file_id == file_id).update(update_stmt, synchronize_session=False)

    db.commit()
    db.refresh(file)

    record_audit_log(
        db=db,
        actor=user,
        action="FILE_UPDATED",
        entity_type="file",
        entity_id=str(file.id),
        entity_name=file.original_filename,
        description=f"User {user.username} updated file metadata in Case ID {file.case_id}",
        details=details,
        client_id=user.client_id,
    )

    return file


# ============================================================
# DELETE FILE
# ============================================================

def delete_uploaded_file(
    db: Session,
    file_id: int,
    user: User,
) -> dict:
    user_id = user.id
    user_role = str(user.role).lower()
    if user_role == USER_ROLE:
        perms = getattr(user, "permissions", None)
        if perms and not perms.can_delete_files:
            raise PermissionError("You do not have permission to delete files. Contact your company administrator.")

    # --------------------------------------------------------
    # Find file belonging to current user or admin
    # --------------------------------------------------------

    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        file = get_file_by_id(db=db, file_id=file_id)
    elif user_role == CLIENT_ADMIN_ROLE:
        file = get_file_by_id(db=db, file_id=file_id)
        if file:
            case = get_case_by_id(db=db, case_id=file.case_id)
            if not case or not (
                case.client_id == user.client_id
                or (case.creator and case.creator.client_id == user.client_id)
                or (case.assignee and case.assignee.client_id == user.client_id)
            ):
                file = None
    else:
        file = get_file_by_id_and_user(
            db=db,
            file_id=file_id,
            user_id=user_id,
        )
        if not file:
            f_candidate = get_file_by_id(db=db, file_id=file_id)
            if f_candidate:
                case = get_case_by_id_and_user(db=db, case_id=f_candidate.case_id, user_id=user_id)
                if case:
                    file = f_candidate

    if not file:
        raise ValueError(
            "File not found"
        )

    saved_file_id = str(file.id)
    saved_filename = file.original_filename
    saved_case_id = file.case_id
    is_merged = bool(getattr(file, "is_merged", False))

    # --------------------------------------------------------
    # Cascade discovery for merged files
    # --------------------------------------------------------
    cascade_files: list[File] = []
    if is_merged:
        cascade_files = get_all_cascade_source_files_for_merged(db=db, merged_file=file)

    all_files_to_delete = [file] + cascade_files
    deleted_file_ids = [f.id for f in all_files_to_delete]

    # Collect all physical paths to unlink after DB commit
    physical_file_paths: list[str] = []
    for f in all_files_to_delete:
        if getattr(f, "file_path", None):
            physical_file_paths.append(str(f.file_path))
        if getattr(f, "raw_excel_path", None):
            physical_file_paths.append(str(f.raw_excel_path))

    # --------------------------------------------------------
    # Delete database records in a single transaction
    # --------------------------------------------------------

    try:
        delete_file(
            db=db,
            file=file,
            cascade_files=cascade_files if is_merged else None,
        )

        description = (
            f"User {user.username} deleted merged file '{saved_filename}' and cascaded deletion of {len(cascade_files)} source files from Case ID {saved_case_id}"
            if is_merged
            else f"User {user.username} deleted file '{saved_filename}' from Case ID {saved_case_id}"
        )

        record_audit_log(
            db=db,
            actor=user,
            action="FILE_DELETED",
            entity_type="file",
            entity_id=saved_file_id,
            entity_name=saved_filename,
            description=description,
            details={
                "file_name": saved_filename,
                "case_id": saved_case_id,
                "deleted_file_ids": deleted_file_ids,
                "is_merged": is_merged,
                "cascade_source_count": len(cascade_files),
            },
            client_id=user.client_id,
        )

    except Exception:
        db.rollback()
        raise

    # --------------------------------------------------------
    # Delete physical files from disk
    # --------------------------------------------------------

    for path_str in physical_file_paths:
        try:
            p = Path(path_str)
            if p.exists() and p.is_file():
                p.unlink()
        except Exception as error:
            print(
                f"Warning: database records deleted but physical file '{path_str}' could not be deleted:",
                error,
            )

    return {
        "file_id": file_id,
        "deleted_file_ids": deleted_file_ids,
        "is_merged": is_merged,
    }


# ============================================================
# ACCOUNT NUMBER NORMALIZATION
# ============================================================

def normalize_account_number(val: str | None) -> str:
    if val is None:
        return ""
    # Strip whitespace, hyphens, slashes, underscores
    cleaned = re.sub(r'[\s\-_/]+', '', str(val)).upper()
    return cleaned


# ============================================================
# MERGE CASE FILES
# ============================================================

def merge_case_files(
    db: Session,
    case_id: int,
    user: User,
    data: MergeFilesRequest,
) -> File:
    user_id = user.id
    user_role = str(user.role).lower()

    if user_role == USER_ROLE:
        perms = getattr(user, "permissions", None)
        if perms and not getattr(perms, "can_upload_files", True):
            raise PermissionError("You do not have permission to merge files. Contact your administrator.")

    # 1. Minimum files check
    unique_file_ids = list(dict.fromkeys(data.file_ids))
    if len(unique_file_ids) < 2:
        raise ValueError("Select at least two files to merge.")

    # 2. Case ownership and permission
    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        case = get_case_by_id(db=db, case_id=case_id)
    elif user_role == CLIENT_ADMIN_ROLE:
        case = get_case_by_id(db=db, case_id=case_id)
        if case and not (
            case.client_id == user.client_id
            or (case.creator and case.creator.client_id == user.client_id)
            or (case.assignee and case.assignee.client_id == user.client_id)
        ):
            case = None
    else:
        case = get_case_by_id_and_user(db=db, case_id=case_id, user_id=user_id)

    if not case:
        raise PermissionError("Case not found or permission denied")

    # 3. Retrieve files
    files = db.query(File).filter(File.id.in_(unique_file_ids)).all()
    if len(files) != len(unique_file_ids):
        raise ValueError("One or more selected files could not be found.")

    # 4. Same case validation
    for f in files:
        if f.case_id != case_id:
            raise ValueError(f"File '{f.original_filename}' does not belong to case {case_id}.")

    # 5. Repeat request idempotency
    existing_merged = get_merged_file_by_sources(db=db, case_id=case_id, source_file_ids=unique_file_ids)
    if existing_merged:
        changed = False
        for f in files:
            if not f.is_superseded or f.superseded_by_file_id != existing_merged.id:
                f.is_superseded = True
                f.superseded_by_file_id = existing_merged.id
                changed = True
        if changed:
            db.commit()
        existing_merged.source_file_ids = get_leaf_source_file_ids_for_merged(db, existing_merged.id) or unique_file_ids
        return existing_merged

    # 6. Status validation (completed & not superseded)
    for f in files:
        if getattr(f, "is_superseded", False):
            raise ValueError(f"Cannot merge: file '{f.original_filename}' has already been merged into another statement.")
        if f.status != "COMPLETED":
            if f.status in {"UPLOADING", "QUEUED", "PROCESSING"}:
                raise ValueError(f"Cannot merge: file '{f.original_filename}' has not completed processing.")
            elif f.status == "FAILED":
                raise ValueError(f"Cannot merge: file '{f.original_filename}' failed processing.")
            else:
                raise ValueError(f"Cannot merge: file '{f.original_filename}' is not in COMPLETED state.")

    # 7. Account number presence and match validation
    norm_accounts = {}
    for f in files:
        norm_acc = normalize_account_number(f.account_number)
        if not norm_acc:
            raise ValueError(f"Cannot merge: file '{f.original_filename}' does not have a valid account number.")
        norm_accounts[f.id] = norm_acc

    unique_accs = set(norm_accounts.values())
    if len(unique_accs) > 1:
        raise ValueError("Cannot merge statements: account numbers do not match across selected files.")

    # 8. Collect all underlying leaf files and prevent duplicate inclusion
    all_leaf_files: list[File] = []
    seen_leaf_ids = set()

    for f in files:
        if getattr(f, "is_merged", False):
            leaves = get_leaf_source_files_for_merged(db, f.id)
            if not leaves:
                leaves = [f]
        else:
            leaves = [f]

        for leaf in leaves:
            if leaf.id in seen_leaf_ids:
                raise ValueError(
                    f"Cannot merge: statement '{leaf.original_filename}' is already included in another selected input."
                )
            seen_leaf_ids.add(leaf.id)
            all_leaf_files.append(leaf)

    all_leaf_file_ids = [lf.id for lf in all_leaf_files]

    # 9. Chronological sorting of leaf files
    sorted_leaf_files = sorted(
        all_leaf_files,
        key=lambda x: (_normalize_to_date(x.statement_start_date) or date.min, x.id)
    )

    primary_file = sorted_leaf_files[0]
    matched_acc_number = primary_file.account_number
    account_name = next((f.account_name for f in sorted_leaf_files if f.account_name), primary_file.account_name)
    bank_name = next((f.bank_name for f in sorted_leaf_files if f.bank_name), primary_file.bank_name)
    branch_name = next((f.branch_name for f in sorted_leaf_files if f.branch_name), primary_file.branch_name)
    ifsc = next((f.ifsc for f in sorted_leaf_files if f.ifsc), primary_file.ifsc)
    micr = next((f.micr for f in sorted_leaf_files if f.micr), primary_file.micr)
    account_type = next((f.account_type for f in sorted_leaf_files if f.account_type), primary_file.account_type)

    start_dates = [_normalize_to_date(f.statement_start_date) for f in all_leaf_files]
    start_dates = [d for d in start_dates if d is not None]

    end_dates = [_normalize_to_date(f.statement_end_date) for f in all_leaf_files]
    end_dates = [d for d in end_dates if d is not None]

    tx_dates = db.query(
        func.min(BankTransaction.transaction_date),
        func.max(BankTransaction.transaction_date)
    ).filter(BankTransaction.file_id.in_(all_leaf_file_ids)).first()

    tx_min = _normalize_to_date(tx_dates[0]) if tx_dates else None
    tx_max = _normalize_to_date(tx_dates[1]) if tx_dates else None

    if tx_min:
        start_dates.append(tx_min)
    if tx_max:
        end_dates.append(tx_max)

    min_start = min(start_dates) if start_dates else None
    max_end = max(end_dates) if end_dates else None

    total_size = sum(f.file_size or 0 for f in all_leaf_files)

    # Sanitize or auto-generate filename
    if data.merged_filename and data.merged_filename.strip():
        raw_name = data.merged_filename.strip()
        clean_name = re.sub(r'[/\\:*?"<>|]', '_', raw_name).strip('. ')
        if not clean_name:
            clean_name = "Merged_Statement.pdf"
        elif not clean_name.lower().endswith(".pdf"):
            clean_name += ".pdf"
        merged_filename = clean_name
    else:
        start_str = min_start.strftime("%d-%m-%Y") if min_start else "start"
        end_str = max_end.strftime("%d-%m-%Y") if max_end else "end"
        merged_filename = f"Merged_Statement_{matched_acc_number}_{start_str}_to_{end_str}.pdf"

    case_directory = create_storage_directory(case_id)
    stored_filename = f"merged_{uuid.uuid4().hex}.pdf"
    dest_path = case_directory / stored_filename

    # 10. Physical document merging (prefer sorted leaf files, fallback to sorted selected files)
    try:
        import pymupdf as fitz
        merged_doc = fitz.open()
        all_pdf = True
        backend_dir = Path(__file__).resolve().parent.parent.parent

        # Attempt to assemble from leaf files in chronological order
        pdf_sources_to_use = sorted_leaf_files
        for lf in pdf_sources_to_use:
            src_path = Path(lf.file_path)
            if not src_path.exists() and (backend_dir / lf.file_path).exists():
                src_path = backend_dir / lf.file_path
            if not (src_path.exists() and src_path.suffix.lower() == ".pdf"):
                all_pdf = False
                break

        # If any leaf PDF missing, check if direct selected input files exist (e.g. intermediate merged PDF)
        if not all_pdf:
            merged_doc.close()
            merged_doc = fitz.open()
            all_pdf = True
            sorted_input_files = sorted(files, key=lambda x: (_normalize_to_date(x.statement_start_date) or date.min, x.id))
            for f in sorted_input_files:
                src_path = Path(f.file_path)
                if not src_path.exists() and (backend_dir / f.file_path).exists():
                    src_path = backend_dir / f.file_path
                if src_path.exists() and src_path.suffix.lower() == ".pdf":
                    try:
                        doc = fitz.open(src_path)
                        merged_doc.insert_pdf(doc)
                        doc.close()
                    except Exception:
                        all_pdf = False
                        break
                else:
                    all_pdf = False
                    break
        else:
            for lf in pdf_sources_to_use:
                src_path = Path(lf.file_path)
                if not src_path.exists() and (backend_dir / lf.file_path).exists():
                    src_path = backend_dir / lf.file_path
                doc = fitz.open(src_path)
                merged_doc.insert_pdf(doc)
                doc.close()

        if all_pdf and len(merged_doc) > 0:
            merged_doc.save(str(dest_path))
            merged_doc.close()
        else:
            if len(merged_doc) > 0:
                merged_doc.close()
            doc = fitz.open()
            page = doc.new_page()
            text = (
                f"Merged Bank Statement Report\n\n"
                f"Case ID: {case_id}\n"
                f"Account Name: {account_name or 'N/A'}\n"
                f"Account Number: {matched_acc_number}\n"
                f"Bank: {bank_name or 'N/A'}\n"
                f"Period: {min_start or 'N/A'} to {max_end or 'N/A'}\n"
                f"Merged Statements ({len(sorted_leaf_files)}):\n"
                + "\n".join(f" - {f.original_filename}" for f in sorted_leaf_files)
            )
            page.insert_text((50, 72), text, fontsize=11)
            doc.save(str(dest_path))
            doc.close()
    except Exception as e:
        print("Notice: PDF merge fell back to text document:", e)
        dest_path.write_text(
            f"Merged Statement for {matched_acc_number}\n"
            f"Source files: {', '.join(f.original_filename for f in sorted_leaf_files)}"
        )

    # 11. Database transaction
    try:
        merged_file = File(
            case_id=case_id,
            created_by=user_id,
            original_filename=merged_filename,
            stored_filename=stored_filename,
            file_path=str(dest_path),
            mime_type="application/pdf",
            file_size=dest_path.stat().st_size if dest_path.exists() else total_size,
            document_type="BANK_STATEMENT",
            status="COMPLETED",
            processing_stage="completed",
            processing_progress="100%",
            account_name=account_name,
            account_number=matched_acc_number,
            bank_name=bank_name,
            branch_name=branch_name,
            ifsc=ifsc,
            micr=micr,
            account_type=account_type,
            statement_start_date=min_start,
            statement_end_date=max_end,
            is_merged=True,
            is_superseded=False,
            superseded_by_file_id=None,
        )
        db.add(merged_file)
        db.flush()

        for fid in all_leaf_file_ids:
            mfs = MergedFileSource(
                merged_file_id=merged_file.id,
                source_file_id=fid,
            )
            db.add(mfs)

        # Mark selected input files as superseded by this merged file
        for f in files:
            f.is_superseded = True
            f.superseded_by_file_id = merged_file.id

        # Also ensure all underlying leaf source files have is_superseded = True
        for lf in all_leaf_files:
            lf.is_superseded = True
            if not lf.superseded_by_file_id:
                lf.superseded_by_file_id = merged_file.id

        db.commit()
        db.refresh(merged_file)

        merged_file.source_file_ids = all_leaf_file_ids

        record_audit_log(
            db=db,
            actor=user,
            action="FILES_MERGED",
            entity_type="file",
            entity_id=str(merged_file.id),
            entity_name=merged_file.original_filename,
            description=f"User {user.username} merged {len(unique_file_ids)} files into '{merged_file.original_filename}' for Case #{case.case_number}",
            details={
                "merged_file_id": merged_file.id,
                "input_file_ids": unique_file_ids,
                "leaf_source_file_ids": all_leaf_file_ids,
                "case_id": case.id,
                "account_number": matched_acc_number,
            },
            client_id=case.client_id,
        )

        return merged_file

    except Exception:
        db.rollback()
        if dest_path.exists():
            try:
                dest_path.unlink()
            except Exception:
                pass
        raise
import os
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.case.case_repository import get_case_by_id_and_user
from app.files.file_model import File
from app.files.file_repository import (
    create_file,
    delete_file,
    get_file_by_id_and_user,
    get_files_by_case_and_user,
)

from app.tasks.bank_statement_task import process_bank_statement


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
    user_id: int,
) -> File:

    # --------------------------------------------------------
    # Check case ownership
    # --------------------------------------------------------

    # Check case ownership
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

    new_file = File(
        case_id=case_id,
        created_by=user_id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=file_path,
        mime_type=file.content_type,
        file_size=file_size,
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
    user_id: int,
) -> list[File]:

    # --------------------------------------------------------
    # Check case ownership
    # --------------------------------------------------------

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
    # Get files
    # --------------------------------------------------------

    return get_files_by_case_and_user(
        db=db,
        case_id=case_id,
        user_id=user_id,
    )


# ============================================================
# GET SINGLE FILE FOR VIEW
# ============================================================

def get_file_for_view(
    db: Session,
    file_id: int,
    user_id: int,
) -> File:

    # --------------------------------------------------------
    # Find file belonging to current user
    # --------------------------------------------------------

    file = get_file_by_id_and_user(
        db=db,
        file_id=file_id,
        user_id=user_id,
    )

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
        raise ValueError(
            "Physical file not found"
        )

    if not physical_file.is_file():
        raise ValueError(
            "Stored path is not a file"
        )

    return file


# ============================================================
# DELETE FILE
# ============================================================

def delete_uploaded_file(
    db: Session,
    file_id: int,
    user_id: int,
) -> None:

    # --------------------------------------------------------
    # Find file belonging to current user
    # --------------------------------------------------------

    file = get_file_by_id_and_user(
        db=db,
        file_id=file_id,
        user_id=user_id,
    )

    if not file:
        raise ValueError(
            "File not found"
        )

    # --------------------------------------------------------
    # Physical file
    # --------------------------------------------------------

    physical_file = Path(
        file.file_path
    )

    # --------------------------------------------------------
    # Delete database record first
    # --------------------------------------------------------

    try:

        delete_file(
            db=db,
            file=file,
        )

    except Exception:

        db.rollback()

        raise

    # --------------------------------------------------------
    # Delete physical file
    # --------------------------------------------------------

    try:

        if physical_file.exists():
            physical_file.unlink()

    except Exception as error:

        print(
            "Warning: database record deleted "
            "but physical file could not be deleted:",
            error,
        )
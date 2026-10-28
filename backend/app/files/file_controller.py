from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.files.file_repository import get_source_file_ids_for_merged
from app.files.file_schema import (
    FileListResponse,
    FileSingleResponse,
    FileUploadResponse,
    FileUpdateRequest,
    MergeFilesRequest,
)
from app.files.file_service import (
    delete_uploaded_file,
    get_case_files,
    get_file_for_view,
    merge_case_files,
    update_uploaded_file,
    upload_file,
)
from app.user.user_model import User


# ============================================================
# UPLOAD
# ============================================================

def upload_file_controller(
    db: Session,
    file: UploadFile,
    case_id: int,
    user: User,
    document_type: str = "BANK_STATEMENT",
    target_client_id: int | None = None,
    target_user_id: int | None = None,
) -> FileUploadResponse:

    uploaded_file = upload_file(
        db=db,
        file=file,
        case_id=case_id,
        user=user,
        document_type=document_type,
        target_client_id=target_client_id,
        target_user_id=target_user_id,
    )

    return FileUploadResponse(
        success=True,
        message="File uploaded successfully",
        data=uploaded_file,
    )


# ============================================================
# GET CASE FILES
# ============================================================

def get_case_files_controller(
    db: Session,
    case_id: int,
    user: User,
    include_superseded: bool = False,
    document_type: str | None = None,
) -> FileListResponse:

    files = get_case_files(
        db=db,
        case_id=case_id,
        user=user,
        include_superseded=include_superseded,
        document_type=document_type,
    )

    for f in files:
        if getattr(f, "is_merged", False):
            f.source_file_ids = get_source_file_ids_for_merged(db, f.id)
        else:
            f.source_file_ids = None

    return FileListResponse(
        success=True,
        message="Files fetched successfully",
        total=len(files),
        data=files,
    )


# ============================================================
# MERGE CASE FILES
# ============================================================

def merge_case_files_controller(
    db: Session,
    case_id: int,
    user: User,
    data: MergeFilesRequest,
) -> FileSingleResponse:

    merged_file = merge_case_files(
        db=db,
        case_id=case_id,
        user=user,
        data=data,
    )

    return FileSingleResponse(
        success=True,
        message="Files merged successfully",
        data=merged_file,
    )


# ============================================================
# GET FILE FOR VIEW
# ============================================================

def get_file_for_view_controller(
    db: Session,
    file_id: int,
    user: User,
):

    return get_file_for_view(
        db=db,
        file_id=file_id,
        user=user,
    )


# ============================================================
# UPDATE FILE
# ============================================================

def update_file_controller(
    db: Session,
    file_id: int,
    user: User,
    data: FileUpdateRequest,
) -> FileSingleResponse:

    updated = update_uploaded_file(
        db=db,
        file_id=file_id,
        user=user,
        data=data,
    )

    return FileSingleResponse(
        success=True,
        message="File updated successfully",
        data=updated,
    )


# ============================================================
# DELETE FILE
# ============================================================

def delete_file_controller(
    db: Session,
    file_id: int,
    user: User,
) -> dict:

    return delete_uploaded_file(
        db=db,
        file_id=file_id,
        user=user,
    )
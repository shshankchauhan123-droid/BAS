from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.files.file_schema import (
    FileListResponse,
    FileSingleResponse,
    FileUploadResponse,
    FileUpdateRequest,
)
from app.files.file_service import (
    delete_uploaded_file,
    get_case_files,
    get_file_for_view,
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
) -> FileUploadResponse:

    uploaded_file = upload_file(
        db=db,
        file=file,
        case_id=case_id,
        user=user,
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
) -> FileListResponse:

    files = get_case_files(
        db=db,
        case_id=case_id,
        user=user,
    )

    return FileListResponse(
        success=True,
        message="Files fetched successfully",
        total=len(files),
        data=files,
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
) -> None:

    delete_uploaded_file(
        db=db,
        file_id=file_id,
        user=user,
    )
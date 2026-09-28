from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.files.file_schema import (
    FileListResponse,
    FileUploadResponse,
)
from app.files.file_service import (
    delete_uploaded_file,
    get_case_files,
    get_file_for_view,
    upload_file,
)


# ============================================================
# UPLOAD
# ============================================================

def upload_file_controller(
    db: Session,
    file: UploadFile,
    case_id: int,
    user_id: int,
) -> FileUploadResponse:

    uploaded_file = upload_file(
        db=db,
        file=file,
        case_id=case_id,
        user_id=user_id,
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
    user_id: int,
) -> FileListResponse:

    files = get_case_files(
        db=db,
        case_id=case_id,
        user_id=user_id,
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
    user_id: int,
):

    return get_file_for_view(
        db=db,
        file_id=file_id,
        user_id=user_id,
    )


# ============================================================
# DELETE FILE
# ============================================================

def delete_file_controller(
    db: Session,
    file_id: int,
    user_id: int,
) -> None:

    delete_uploaded_file(
        db=db,
        file_id=file_id,
        user_id=user_id,
    )
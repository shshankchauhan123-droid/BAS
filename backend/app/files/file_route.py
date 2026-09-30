from fastapi import (
    APIRouter,
    Depends,
    File as FastAPIFile,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user

from app.files.file_controller import (
    delete_file_controller,
    get_case_files_controller,
    get_file_for_view_controller,
    upload_file_controller,
)

from app.files.file_schema import (
    FileListResponse,
    FileUploadResponse,
)


router = APIRouter(
    prefix="/api/v1/files",
    tags=["File Management"],
)


# ============================================================
# UPLOAD FILE
# ============================================================

@router.post(
    "/{case_id}/upload",
    response_model=FileUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_file_route(
    case_id: int,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    try:

        return upload_file_controller(
            db=db,
            file=file,
            case_id=case_id,
            user_id=current_user.id,
        )

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


# ============================================================
# GET CASE FILES
# ============================================================

@router.get(
    "/case/{case_id}",
    response_model=FileListResponse,
    status_code=status.HTTP_200_OK,
)
def get_case_files_route(
    case_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    try:

        return get_case_files_controller(
            db=db,
            case_id=case_id,
            user_id=current_user.id,
        )

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


# ============================================================
# VIEW FILE
# ============================================================

@router.get(
    "/{file_id}/view",
    status_code=status.HTTP_200_OK,
)
def view_file_route(
    file_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    try:

        file = get_file_for_view_controller(
            db=db,
            file_id=file_id,
            user_id=current_user.id,
        )

        return FileResponse(
            path=file.file_path,
            media_type=file.mime_type
            or "application/octet-stream",
            filename=file.original_filename,
            content_disposition_type="inline",
        )

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


# ============================================================
# DELETE FILE
# ============================================================

@router.delete(
    "/{file_id}",
    status_code=status.HTTP_200_OK,
)
def delete_file_route(
    file_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Users are not permitted to delete case files. Uploaded case files are protected evidence.",
        )

    try:

        delete_file_controller(
            db=db,
            file_id=file_id,
            user_id=current_user.id,
        )

        return {
            "success": True,
            "message": "File deleted successfully",
            "data": {
                "file_id": file_id,
            },
        }

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )
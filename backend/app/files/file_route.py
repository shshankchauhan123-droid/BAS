from pathlib import Path
from fastapi import (
    APIRouter,
    Query,
    Depends,
    File as FastAPIFile,
    Form,
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
    merge_case_files_controller,
    update_file_controller,
    upload_file_controller,
)

from app.files.file_schema import (
    FileListResponse,
    FileSingleResponse,
    FileUploadResponse,
    FileUpdateRequest,
    MergeFilesRequest,
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
    document_type: str = Form(default="BANK_STATEMENT"),
    client_id: int | None = Form(default=None),
    user_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    try:
        valid_doc_type = (document_type or "BANK_STATEMENT").strip().upper()
        if valid_doc_type not in {"BANK_STATEMENT", "UNKNOWN"}:
            valid_doc_type = "BANK_STATEMENT"

        return upload_file_controller(
            db=db,
            file=file,
            case_id=case_id,
            user=current_user,
            document_type=valid_doc_type,
            target_client_id=client_id,
            target_user_id=user_id,
        )

    except PermissionError as error:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    except Exception as error:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(error)}",
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
    include_superseded: bool = Query(
        default=False,
        description="Include superseded source files that have been merged",
    ),
    document_type: str | None = Query(
        default=None,
        description="Filter by document type (e.g. BANK_STATEMENT)",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    try:

        return get_case_files_controller(
            db=db,
            case_id=case_id,
            user=current_user,
            include_superseded=include_superseded,
            document_type=document_type,
        )

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


# ============================================================
# MERGE CASE FILES
# ============================================================

@router.post(
    "/case/{case_id}/merge",
    response_model=FileSingleResponse,
    status_code=status.HTTP_200_OK,
)
def merge_case_files_route(
    case_id: int,
    data: MergeFilesRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return merge_case_files_controller(
            db=db,
            case_id=case_id,
            user=current_user,
            data=data,
        )
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
    except Exception as error:
        import logging
        import traceback
        logging.getLogger(__name__).error(f"Merge error in case {case_id}: {error}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Merge failed: {str(error)}",
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
            user=current_user,
        )

        file_path = Path(file.file_path)
        if not file_path.exists():
            backend_dir = Path(__file__).resolve().parent.parent.parent
            if (backend_dir / file.file_path).exists():
                file_path = backend_dir / file.file_path

        return FileResponse(
            path=file_path,
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
# UPDATE FILE
# ============================================================

@router.patch(
    "/{file_id}",
    response_model=FileSingleResponse,
    status_code=status.HTTP_200_OK,
)
def update_file_route(
    file_id: int,
    data: FileUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    try:

        return update_file_controller(
            db=db,
            file_id=file_id,
            user=current_user,
            data=data,
        )

    except PermissionError as error:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
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

    try:

        result = delete_file_controller(
            db=db,
            file_id=file_id,
            user=current_user,
        )

        return {
            "success": True,
            "message": "File deleted successfully",
            "data": result,
        }

    except PermissionError as error:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )
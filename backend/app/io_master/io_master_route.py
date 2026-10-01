from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.io_master.io_master_controller import (
    create_io_controller,
    get_ios_controller,
    get_io_controller,
    update_io_controller,
    delete_io_controller,
)
from app.io_master.io_master_schema import (
    IOMasterCreateRequest,
    IOMasterUpdateRequest,
    IOMasterResponse,
    IOMasterListResponse,
)

router = APIRouter(
    prefix="/api/v1/io-master",
    tags=["IO Master"],
)


@router.post(
    "/",
    response_model=IOMasterResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_io_route(
    data: IOMasterCreateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return create_io_controller(
            db=db,
            data=data,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get(
    "/",
    response_model=IOMasterListResponse,
    status_code=status.HTTP_200_OK,
)
def get_ios_route(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return get_ios_controller(
            db=db,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get(
    "/{io_id}",
    response_model=IOMasterResponse,
    status_code=status.HTTP_200_OK,
)
def get_io_route(
    io_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return get_io_controller(
            db=db,
            io_id=io_id,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


@router.put(
    "/{io_id}",
    response_model=IOMasterResponse,
    status_code=status.HTTP_200_OK,
)
def update_io_route(
    io_id: int,
    data: IOMasterUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return update_io_controller(
            db=db,
            io_id=io_id,
            data=data,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.delete(
    "/{io_id}",
    status_code=status.HTTP_200_OK,
)
def delete_io_route(
    io_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return delete_io_controller(
            db=db,
            io_id=io_id,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )

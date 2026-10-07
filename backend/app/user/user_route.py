from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.roles import CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE
from app.dependencies.auth import get_current_user, require_roles
from app.user.user_controller import (
    create_user_controller,
    get_user_by_id,
    list_users_controller,
    update_user_permissions_controller,
    update_user_status_controller,
)
from app.user.user_model import User
from app.user.user_schema import (
    UserCreateRequest,
    UserListResponse,
    UserPermissionsUpdateRequest,
    UserResponse,
    UserUpdateStatusRequest,
)


router = APIRouter(
    prefix="/api/v1/users",
    tags=["User Management"],
)


@router.get(
    "",
    response_model=UserListResponse,
    status_code=status.HTTP_200_OK,
    summary="List users (Client Admin sees company users; Superadmin sees all or filtered by client)",
)
@router.get(
    "/",
    include_in_schema=False,
    response_model=UserListResponse,
    status_code=status.HTTP_200_OK,
)
def list_users_route(
    client_id: int | None = Query(default=None, description="Filter by client ID (SuperAdmin only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([SUPERADMIN_ROLE, CLIENT_ADMIN_ROLE])
    ),
):
    try:
        return list_users_controller(
            db=db,
            actor=current_user,
            client_id=client_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user under the client company (Subject to seat quota)",
)
@router.post(
    "/",
    include_in_schema=False,
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user_route(
    data: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([SUPERADMIN_ROLE, CLIENT_ADMIN_ROLE])
    ),
):
    try:
        return create_user_controller(
            db=db,
            actor=current_user,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user profile details",
)
def get_user_route(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_user_by_id(
            db=db,
            user_id=user_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Toggle user active status (Client Admin for company users, SuperAdmin for any user)",
)
def update_user_status_route(
    user_id: int,
    data: UserUpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([SUPERADMIN_ROLE, CLIENT_ADMIN_ROLE])
    ),
):
    try:
        return update_user_status_controller(
            db=db,
            actor=current_user,
            user_id=user_id,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.put(
    "/{user_id}/permissions",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update user access permissions/rights (Client Admin for company users, SuperAdmin for any user)",
)
def update_user_permissions_route(
    user_id: int,
    data: UserPermissionsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([SUPERADMIN_ROLE, CLIENT_ADMIN_ROLE])
    ),
):
    try:
        return update_user_permissions_controller(
            db=db,
            actor=current_user,
            user_id=user_id,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
from app.user.user_schema import UserUpdateRequest
from app.user.user_controller import update_user_controller, delete_user_controller

@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update user details (username, email, password)",
)
def update_user_route(
    user_id: int,
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([SUPERADMIN_ROLE, CLIENT_ADMIN_ROLE])
    ),
):
    try:
        return update_user_controller(
            db=db,
            actor=current_user,
            user_id=user_id,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user",
)
def delete_user_route(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([SUPERADMIN_ROLE, CLIENT_ADMIN_ROLE])
    ),
):
    try:
        delete_user_controller(
            db=db,
            actor=current_user,
            user_id=user_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


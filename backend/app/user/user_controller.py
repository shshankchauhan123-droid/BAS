from sqlalchemy.orm import Session

from app.user.user_model import User
from app.user.user_schema import (
    UserCreateRequest,
    UserListResponse,
    UserPermissionsSchema,
    UserPermissionsUpdateRequest,
    UserQuotaInfo,
    UserResponse,
    UserUpdateStatusRequest,
)
from app.user.user_service import (
    create_user_by_admin,
    get_user_details,
    list_users_for_actor,
    update_user_permissions_by_actor,
    update_user_status_by_actor,
)


def _format_user_response(user: User) -> UserResponse:
    perms_schema = None
    if getattr(user, "permissions", None):
        perms_schema = UserPermissionsSchema.model_validate(user.permissions)
    elif str(user.role).lower() in {"superadmin", "client_admin"}:
        perms_schema = UserPermissionsSchema(
            can_create_case=True,
            can_upload_files=True,
            can_update_files=True,
            can_delete_files=True,
        )
    else:
        perms_schema = UserPermissionsSchema(
            can_create_case=True,
            can_upload_files=True,
            can_update_files=True,
            can_delete_files=True,
        )

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        client_id=user.client_id,
        first_login=user.first_login,
        permissions=perms_schema,
    )



def get_user_by_id(
    db: Session,
    user_id: int,
) -> UserResponse:
    user = get_user_details(
        db=db,
        user_id=user_id,
    )
    return _format_user_response(user)


def create_user_controller(
    db: Session,
    actor: User,
    data: UserCreateRequest,
) -> UserResponse:
    user = create_user_by_admin(
        db=db,
        actor=actor,
        data=data,
    )
    return _format_user_response(user)


def list_users_controller(
    db: Session,
    actor: User,
    client_id: int | None = None,
) -> UserListResponse:
    users, quota_data = list_users_for_actor(
        db=db,
        actor=actor,
        client_id=client_id,
    )
    items = [_format_user_response(u) for u in users]
    quota = UserQuotaInfo(**quota_data) if quota_data else None
    return UserListResponse(
        items=items,
        users=items,
        total=len(items),
        quota=quota,
    )


def update_user_status_controller(
    db: Session,
    actor: User,
    user_id: int,
    data: UserUpdateStatusRequest,
) -> UserResponse:
    user = update_user_status_by_actor(
        db=db,
        actor=actor,
        user_id=user_id,
        is_active=data.is_active,
    )
    return _format_user_response(user)


def update_user_permissions_controller(
    db: Session,
    actor: User,
    user_id: int,
    data: UserPermissionsUpdateRequest,
) -> UserResponse:
    user = update_user_permissions_by_actor(
        db=db,
        actor=actor,
        user_id=user_id,
        data=data,
    )
    return _format_user_response(user)
from app.user.user_schema import UserUpdateRequest
from app.user.user_service import update_user_by_actor, delete_user_by_actor

def update_user_controller(
    db: Session,
    actor: User,
    user_id: int,
    data: UserUpdateRequest,
) -> UserResponse:
    user = update_user_by_actor(
        db=db,
        actor=actor,
        user_id=user_id,
        data=data,
    )
    return _format_user_response(user)
    
def delete_user_controller(
    db: Session,
    actor: User,
    user_id: int,
) -> None:
    delete_user_by_actor(
        db=db,
        actor=actor,
        user_id=user_id,
    )


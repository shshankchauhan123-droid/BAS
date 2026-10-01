from sqlalchemy.orm import Session

from app.client.client_repository import get_client_by_id
from app.core.roles import CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE, USER_ROLE
from app.core.security import hash_password
from app.audit.audit_service import record_audit_log
from app.user.user_model import User
from app.user.user_repository import (
    count_users_in_client,
    create_or_update_user_permissions,
    create_user_with_client,
    get_all_users,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    get_users_by_client_id,
    update_user_status,
)
from app.user.user_schema import (
    UserCreateRequest,
    UserPermissionsUpdateRequest,
)



def get_user_details(
    db: Session,
    user_id: int,
) -> User:
    user = get_user_by_id(
        db=db,
        user_id=user_id,
    )

    if not user:
        raise ValueError("User not found")

    return user


def create_user_by_admin(
    db: Session,
    actor: User,
    data: UserCreateRequest,
) -> User:
    actor_role = str(actor.role).lower()

    if actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id:
            raise ValueError("Client admin is not associated with any client company.")

        client_id = actor.client_id
        client = get_client_by_id(db, client_id)
        if not client:
            raise ValueError("Client company not found.")
        if not client.is_active:
            raise ValueError("Your company account is inactive. User creation is disabled.")

        current_count = count_users_in_client(db, client_id)
        if current_count >= client.max_users:
            raise ValueError(
                f"User quota reached ({current_count}/{client.max_users}). Cannot create more users. Contact Superadmin to increase your user limit."
            )

        assigned_role = USER_ROLE

    elif actor_role in {SUPERADMIN_ROLE, "admin"}:
        client_id = data.client_id
        if client_id:
            client = get_client_by_id(db, client_id)
            if not client:
                raise ValueError("Specified client company not found.")
            current_count = count_users_in_client(db, client_id)
            if current_count >= client.max_users:
                raise ValueError(
                    f"User quota reached for this client ({current_count}/{client.max_users})."
                )
        assigned_role = USER_ROLE
    else:
        raise ValueError("You do not have permission to create users.")

    # Validate Uniqueness
    cleaned_username = data.username.strip()
    cleaned_email = data.email.strip().lower()

    if get_user_by_username(db, cleaned_username):
        raise ValueError(f"Username '{cleaned_username}' is already taken.")

    if get_user_by_email(db, cleaned_email):
        raise ValueError(f"Email '{cleaned_email}' is already in use.")

    password_hash = hash_password(data.password)

    user = create_user_with_client(
        db=db,
        username=cleaned_username,
        email=cleaned_email,
        password_hash=password_hash,
        role=assigned_role,
        client_id=client_id,
        first_login=True,  # Will prompt to change password on first login
    )

    # Initialize user permissions
    can_view_cases = True
    can_create_case = True
    can_update_case = True
    can_upload_files = True
    can_process_files = True
    can_update_files = True
    can_delete_files = True
    if data.permissions:
        can_view_cases = getattr(data.permissions, "can_view_cases", True)
        can_create_case = getattr(data.permissions, "can_create_case", True)
        can_update_case = getattr(data.permissions, "can_update_case", True)
        can_upload_files = getattr(data.permissions, "can_upload_files", True)
        can_process_files = getattr(data.permissions, "can_process_files", True)
        can_update_files = getattr(data.permissions, "can_update_files", True)
        can_delete_files = getattr(data.permissions, "can_delete_files", True)

    create_or_update_user_permissions(
        db=db,
        user_id=user.id,
        can_view_cases=can_view_cases,
        can_create_case=can_create_case,
        can_update_case=can_update_case,
        can_upload_files=can_upload_files,
        can_process_files=can_process_files,
        can_update_files=can_update_files,
        can_delete_files=can_delete_files,
    )
    db.refresh(user)

    record_audit_log(
        db=db,
        actor=actor,
        action="USER_CREATED",
        entity_type="user",
        entity_id=str(user.id),
        entity_name=user.username,
        description=f"{actor.role.capitalize()} {actor.username} created user '{user.username}' ({user.email})",
        details={
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "client_id": client_id,
            "permissions": {
                "can_view_cases": can_view_cases,
                "can_create_case": can_create_case,
                "can_update_case": can_update_case,
                "can_upload_files": can_upload_files,
                "can_process_files": can_process_files,
                "can_update_files": can_update_files,
                "can_delete_files": can_delete_files,
            },
        },
        client_id=client_id or actor.client_id,
    )

    return user



def list_users_for_actor(
    db: Session,
    actor: User,
    client_id: int | None = None,
) -> tuple[list[User], dict | None]:
    actor_role = str(actor.role).lower()

    if actor_role in {SUPERADMIN_ROLE, "admin"}:
        if client_id:
            users = get_users_by_client_id(db, client_id)
            client = get_client_by_id(db, client_id)
            quota = None
            if client:
                used = len(users)
                quota = {
                    "client_id": client.id,
                    "client_name": client.name,
                    "used_seats": used,
                    "active_users": used,
                    "max_seats": client.max_users,
                    "max_users": client.max_users,
                    "remaining_seats": max(0, client.max_users - used),
                    "is_limit_reached": used >= client.max_users,
                }
            return users, quota
        else:
            users = get_all_users(db)
            return users, None

    elif actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id:
            return [], None
        users = get_users_by_client_id(db, actor.client_id)
        client = get_client_by_id(db, actor.client_id)
        max_seats = client.max_users if client else 0
        used = len(users)
        quota = {
            "client_id": actor.client_id,
            "client_name": client.name if client else "Enterprise Client",
            "used_seats": used,
            "active_users": used,
            "max_seats": max_seats,
            "max_users": max_seats,
            "remaining_seats": max(0, max_seats - used),
            "is_limit_reached": used >= max_seats if max_seats > 0 else False,
        }
        return users, quota

    else:
        raise ValueError("You do not have permission to list users.")


def update_user_status_by_actor(
    db: Session,
    actor: User,
    user_id: int,
    is_active: bool,
) -> User:
    actor_role = str(actor.role).lower()
    target_user = get_user_by_id(db, user_id)
    if not target_user:
        raise ValueError("User not found.")

    if actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id or target_user.client_id != actor.client_id:
            raise ValueError("You can only manage users within your own company.")
        if target_user.id == actor.id:
            raise ValueError("You cannot alter your own admin access status.")
    elif actor_role in {SUPERADMIN_ROLE, "admin"}:
        pass
    else:
        raise ValueError("You do not have permission to manage user status.")

    old_status = target_user.is_active
    updated_user = update_user_status(db, target_user, is_active)

    record_audit_log(
        db=db,
        actor=actor,
        action="USER_STATUS_TOGGLED",
        entity_type="user",
        entity_id=str(target_user.id),
        entity_name=target_user.username,
        description=f"{actor.role.capitalize()} {actor.username} {'activated' if is_active else 'deactivated'} user '{target_user.username}'",
        details={
            "target_user_id": target_user.id,
            "target_username": target_user.username,
            "old_status": old_status,
            "new_status": is_active,
        },
        client_id=target_user.client_id or actor.client_id,
    )

    return updated_user


def update_user_permissions_by_actor(
    db: Session,
    actor: User,
    user_id: int,
    data: UserPermissionsUpdateRequest,
) -> User:
    actor_role = str(actor.role).lower()
    target_user = get_user_by_id(db, user_id)
    if not target_user:
        raise ValueError("User not found.")

    if actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id or target_user.client_id != actor.client_id:
            raise ValueError("You can only manage users within your own company.")
        if target_user.id == actor.id:
            raise ValueError("You cannot alter your own admin permissions.")
    elif actor_role in {SUPERADMIN_ROLE, "admin"}:
        pass
    else:
        raise ValueError("You do not have permission to manage user permissions.")

    old_perms = {
        "can_view_cases": target_user.permissions.can_view_cases if target_user.permissions else True,
        "can_create_case": target_user.permissions.can_create_case if target_user.permissions else True,
        "can_update_case": target_user.permissions.can_update_case if target_user.permissions else True,
        "can_upload_files": target_user.permissions.can_upload_files if target_user.permissions else True,
        "can_process_files": target_user.permissions.can_process_files if target_user.permissions else True,
        "can_update_files": target_user.permissions.can_update_files if target_user.permissions else True,
        "can_delete_files": target_user.permissions.can_delete_files if target_user.permissions else True,
    }

    create_or_update_user_permissions(
        db=db,
        user_id=target_user.id,
        can_view_cases=getattr(data, "can_view_cases", True),
        can_create_case=getattr(data, "can_create_case", True),
        can_update_case=getattr(data, "can_update_case", True),
        can_upload_files=getattr(data, "can_upload_files", True),
        can_process_files=getattr(data, "can_process_files", True),
        can_update_files=getattr(data, "can_update_files", True),
        can_delete_files=getattr(data, "can_delete_files", True),
    )
    db.refresh(target_user)

    record_audit_log(
        db=db,
        actor=actor,
        action="PERMISSIONS_UPDATED",
        entity_type="user",
        entity_id=str(target_user.id),
        entity_name=target_user.username,
        description=f"{actor.role.capitalize()} {actor.username} updated permissions for user '{target_user.username}'",
        details={
            "target_user_id": target_user.id,
            "target_username": target_user.username,
            "old_permissions": old_perms,
            "new_permissions": {
                "can_view_cases": getattr(data, "can_view_cases", True),
                "can_create_case": getattr(data, "can_create_case", True),
                "can_update_case": getattr(data, "can_update_case", True),
                "can_upload_files": getattr(data, "can_upload_files", True),
                "can_process_files": getattr(data, "can_process_files", True),
                "can_update_files": getattr(data, "can_update_files", True),
                "can_delete_files": getattr(data, "can_delete_files", True),
            },
        },
        client_id=target_user.client_id or actor.client_id,
    )

    return target_user
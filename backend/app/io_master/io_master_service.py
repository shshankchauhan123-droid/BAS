from sqlalchemy.orm import Session

from app.audit.audit_service import record_audit_log
from app.core.roles import ADMIN_ROLE, CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE, USER_ROLE
from app.io_master.io_master_model import IOMaster
from app.io_master.io_master_repository import (
    create_io as repository_create_io,
    get_ios_by_user,
    get_ios_by_client,
    get_io_by_id_and_user,
    get_io_by_id,
    update_io as repository_update_io,
    delete_io as repository_delete_io,
)
from app.io_master.io_master_schema import (
    IOMasterCreateRequest,
    IOMasterUpdateRequest,
)
from app.user.user_model import User
from app.user.user_repository import get_user_by_id


def create_io_service(
    db: Session,
    data: IOMasterCreateRequest,
    actor: User,
    target_user_id: int | None = None,
) -> IOMaster:
    actor_role = str(actor.role).lower()

    if actor_role == USER_ROLE:
        perms = getattr(actor, "permissions", None)
        if perms and perms.can_create_io is False:
            raise PermissionError("You do not have permission to create Investigating Officers.")

    if target_user_id is None:
        if actor_role == CLIENT_ADMIN_ROLE:
            raise ValueError("Target user must be selected for Investigating Officer creation.")
        effective_user_id = actor.id
    else:
        if actor_role not in {CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE, ADMIN_ROLE}:
            raise PermissionError("Normal users cannot create Investigating Officers for other users.")

        target_user = get_user_by_id(db=db, user_id=target_user_id)
        if not target_user:
            raise ValueError("Target user not found.")

        if actor_role == CLIENT_ADMIN_ROLE:
            if target_user.client_id != actor.client_id:
                raise PermissionError("Target user does not belong to your company.")
            if target_user.role != USER_ROLE:
                raise PermissionError("Investigating Officers can only be assigned to users with role 'user'.")
            if not target_user.is_active:
                raise ValueError("Cannot assign Investigating Officer to an inactive user.")

        effective_user_id = target_user.id

    officer_name = data.officer_name.strip()
    designation = data.designation.strip()
    police_station = data.police_station.strip()

    if not officer_name:
        raise ValueError("Officer name is required.")

    if not designation:
        raise ValueError("Designation is required.")

    if not police_station:
        raise ValueError("Police station / branch is required.")

    new_io = IOMaster(
        officer_name=officer_name,
        designation=designation,
        police_station=police_station,
        created_by=effective_user_id,
    )

    created_io = repository_create_io(
        db=db,
        io=new_io,
    )

    record_audit_log(
        db=db,
        actor=actor,
        action="IO_CREATED",
        entity_type="io_master",
        entity_id=str(created_io.id),
        entity_name=created_io.officer_name,
        description=f"{actor.role.capitalize()} {actor.username} created IO '{created_io.officer_name}'" + (f" for user ID {effective_user_id}" if effective_user_id != actor.id else ""),
        details={
            "officer_name": created_io.officer_name,
            "designation": created_io.designation,
            "police_station": created_io.police_station,
            "created_by": effective_user_id,
        },
        client_id=actor.client_id,
    )

    return created_io


def get_ios_service(
    db: Session,
    actor: User,
    target_user_id: int | None = None,
) -> list[IOMaster]:
    actor_role = str(actor.role).lower()

    if actor_role == USER_ROLE:
        perms = getattr(actor, "permissions", None)
        if perms and perms.can_view_io is False:
            raise PermissionError("You do not have permission to view Investigating Officers.")

    if target_user_id is None:
        if actor_role == CLIENT_ADMIN_ROLE:
            if not actor.client_id:
                return []
            return get_ios_by_client(
                db=db,
                client_id=actor.client_id,
            )
        return get_ios_by_user(
            db=db,
            user_id=actor.id,
        )

    if actor_role not in {CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE, ADMIN_ROLE}:
        raise PermissionError("Normal users cannot view other users' Investigating Officers.")

    target_user = get_user_by_id(db=db, user_id=target_user_id)
    if not target_user:
        raise ValueError("Target user not found.")

    if actor_role == CLIENT_ADMIN_ROLE:
        if target_user.client_id != actor.client_id:
            raise PermissionError("Target user does not belong to your company.")

    return get_ios_by_user(
        db=db,
        user_id=target_user.id,
    )


def get_io_service(
    db: Session,
    io_id: int,
    actor: User | None = None,
    user_id: int | None = None,
) -> IOMaster:
    if actor is None:
        if user_id is None:
            raise ValueError("User or actor required to retrieve Investigating Officer.")
        actor = get_user_by_id(db=db, user_id=user_id)
        if not actor:
            raise ValueError("User not found.")

    actor_role = str(actor.role).lower()

    if actor_role == CLIENT_ADMIN_ROLE:
        io = get_io_by_id(db=db, io_id=io_id)
        if not io:
            raise ValueError("Investigating Officer not found.")
        if not io.creator or io.creator.client_id != actor.client_id:
            raise PermissionError("Access denied. Investigating Officer does not belong to your company.")
        return io

    if actor_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        io = get_io_by_id(db=db, io_id=io_id)
        if not io:
            raise ValueError("Investigating Officer not found.")
        return io

    if actor_role == USER_ROLE:
        perms = getattr(actor, "permissions", None)
        if perms and perms.can_view_io is False:
            raise PermissionError("You do not have permission to view Investigating Officers.")

    io = get_io_by_id_and_user(
        db=db,
        io_id=io_id,
        user_id=actor.id,
    )

    if not io:
        raise ValueError("Investigating Officer not found.")

    return io


def update_io_service(
    db: Session,
    io_id: int,
    data: IOMasterUpdateRequest,
    user_id: int,
) -> IOMaster:
    user = get_user_by_id(db=db, user_id=user_id)
    if user and str(user.role).lower() == USER_ROLE:
        perms = getattr(user, "permissions", None)
        if perms and perms.can_update_io is False:
            raise PermissionError("You do not have permission to update Investigating Officers.")

    io = get_io_by_id_and_user(
        db=db,
        io_id=io_id,
        user_id=user_id,
    )
    if not io:
        raise ValueError("Investigating Officer not found.")

    if data.officer_name is not None:
        officer_name = data.officer_name.strip()
        if not officer_name:
            raise ValueError("Officer name cannot be empty.")
        io.officer_name = officer_name

    if data.designation is not None:
        designation = data.designation.strip()
        if not designation:
            raise ValueError("Designation cannot be empty.")
        io.designation = designation

    if data.police_station is not None:
        police_station = data.police_station.strip()
        if not police_station:
            raise ValueError("Police station cannot be empty.")
        io.police_station = police_station

    return repository_update_io(
        db=db,
        io=io,
    )


def delete_io_service(
    db: Session,
    io_id: int,
    user_id: int,
) -> None:
    user = get_user_by_id(db=db, user_id=user_id)
    if user and str(user.role).lower() == USER_ROLE:
        perms = getattr(user, "permissions", None)
        if perms and perms.can_delete_io is False:
            raise PermissionError("You do not have permission to delete Investigating Officers.")

    io = get_io_by_id_and_user(
        db=db,
        io_id=io_id,
        user_id=user_id,
    )
    if not io:
        raise ValueError("Investigating Officer not found.")

    repository_delete_io(
        db=db,
        io=io,
    )

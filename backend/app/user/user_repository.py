from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.user.user_model import User
from app.user.user_permission_model import UserPermission


def get_user_by_username(
    db: Session,
    username: str,
) -> User | None:
    cleaned = username.strip()

    exact = (
        db.execute(
            select(User).where(User.username == cleaned)
        )
        .scalars()
        .first()
    )

    if exact:
        return exact

    return (
        db.execute(
            select(User).where(
                func.lower(User.username) == cleaned.lower()
            )
        )
        .scalars()
        .first()
    )


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    cleaned = email.strip().lower()

    return (
        db.execute(
            select(User).where(
                func.lower(User.email) == cleaned
            )
        )
        .scalars()
        .first()
    )


def get_user_by_id(
    db: Session,
    user_id: int,
) -> User | None:
    statement = select(User).where(User.id == user_id)

    return db.execute(statement).scalar_one_or_none()


def get_users_by_client_id(
    db: Session,
    client_id: int,
) -> list[User]:
    statement = (
        select(User)
        .where(User.client_id == client_id)
        .order_by(User.created_at.desc())
    )

    return list(
        db.execute(statement).scalars().all()
    )


def get_all_users(
    db: Session,
) -> list[User]:
    statement = (
        select(User)
        .order_by(User.created_at.desc())
    )

    return list(
        db.execute(statement).scalars().all()
    )


def count_users_in_client(
    db: Session,
    client_id: int,
) -> int:
    statement = (
        select(func.count(User.id))
        .where(User.client_id == client_id)
    )

    return db.scalar(statement) or 0


def get_user_permissions(
    db: Session,
    user_id: int,
) -> UserPermission | None:
    return (
        db.execute(
            select(UserPermission).where(
                UserPermission.user_id == user_id
            )
        )
        .scalar_one_or_none()
    )


def create_user_with_client(
    db: Session,
    username: str,
    email: str,
    password_hash: str,
    role: str,
    client_id: int | None = None,
    first_login: bool = False,
) -> User:
    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role=role,
        client_id=client_id,
        is_active=True,
        first_login=first_login,
    )

    db.add(user)
    db.flush()

    return user


def create_or_update_user_permissions(
    db: Session,
    user_id: int,
    can_view_cases: bool = True,
    can_create_case: bool = True,
    can_update_case: bool = True,
    can_upload_files: bool = True,
    can_process_files: bool = True,
    can_update_files: bool = True,
    can_delete_files: bool = True,
) -> UserPermission:
    permissions = get_user_permissions(
        db=db,
        user_id=user_id,
    )

    if permissions is None:
        permissions = UserPermission(
            user_id=user_id,
            can_view_cases=can_view_cases,
            can_create_case=can_create_case,
            can_update_case=can_update_case,
            can_upload_files=can_upload_files,
            can_process_files=can_process_files,
            can_update_files=can_update_files,
            can_delete_files=can_delete_files,
        )

        db.add(permissions)

    else:
        permissions.can_view_cases = can_view_cases
        permissions.can_create_case = can_create_case
        permissions.can_update_case = can_update_case
        permissions.can_upload_files = can_upload_files
        permissions.can_process_files = can_process_files
        permissions.can_update_files = can_update_files
        permissions.can_delete_files = can_delete_files

    db.flush()

    return permissions


def update_user_status(
    db: Session,
    user: User,
    is_active: bool,
) -> User:
    user.is_active = is_active

    db.flush()

    return user
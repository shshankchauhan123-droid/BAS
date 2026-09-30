from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.user.user_model import User


def get_user_by_username(
    db: Session,
    username: str,
) -> User | None:
    cleaned = username.strip()
    exact = db.execute(select(User).where(User.username == cleaned)).scalars().first()
    if exact:
        return exact
    return db.execute(select(User).where(func.lower(User.username) == cleaned.lower())).scalars().first()


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    cleaned = email.strip()
    return db.execute(select(User).where(func.lower(User.email) == cleaned.lower())).scalars().first()


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
    return list(db.execute(statement).scalars().all())


def get_all_users(
    db: Session,
) -> list[User]:
    statement = select(User).order_by(User.created_at.desc())
    return list(db.execute(statement).scalars().all())


def count_users_in_client(
    db: Session,
    client_id: int,
) -> int:
    statement = select(func.count(User.id)).where(User.client_id == client_id)
    return db.scalar(statement) or 0


def create_user(
    db: Session,
    username: str,
    email: str,
    password_hash: str,
) -> User:
    user_count = db.scalar(select(func.count()).select_from(User))
    role = "superadmin" if user_count == 0 else "user"

    user = User(
        username=username.strip(),
        email=email.strip().lower(),
        password_hash=password_hash,
        role=role,
        is_active=True,
        first_login=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_user_with_client(
    db: Session,
    username: str,
    email: str,
    password_hash: str,
    role: str,
    client_id: int | None,
    first_login: bool = True,
) -> User:
    user = User(
        username=username.strip(),
        email=email.strip().lower(),
        password_hash=password_hash,
        role=role,
        client_id=client_id,
        is_active=True,
        first_login=first_login,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_status(
    db: Session,
    user: User,
    is_active: bool,
) -> User:
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


def get_user_permissions(
    db: Session,
    user_id: int,
):
    from app.user.user_permission_model import UserPermission
    return db.execute(select(UserPermission).where(UserPermission.user_id == user_id)).scalar_one_or_none()


def create_or_update_user_permissions(
    db: Session,
    user_id: int,
    can_create_case: bool = True,
    can_upload_files: bool = True,
    can_update_files: bool = True,
    can_delete_files: bool = True,
):
    from app.user.user_permission_model import UserPermission
    perm = get_user_permissions(db, user_id)
    if not perm:
        perm = UserPermission(
            user_id=user_id,
            can_create_case=can_create_case,
            can_upload_files=can_upload_files,
            can_update_files=can_update_files,
            can_delete_files=can_delete_files,
        )
        db.add(perm)
    else:
        perm.can_create_case = can_create_case
        perm.can_upload_files = can_upload_files
        perm.can_update_files = can_update_files
        perm.can_delete_files = can_delete_files
    db.commit()
    db.refresh(perm)
    return perm
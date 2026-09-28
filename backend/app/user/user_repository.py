from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.user.user_model import User


def get_user_by_username(
    db: Session,
    username: str,
) -> User | None:
    statement = select(User).where(User.username == username)
    return db.execute(statement).scalar_one_or_none()


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    statement = select(User).where(User.email == email)
    return db.execute(statement).scalar_one_or_none()


def create_user(
    db: Session,
    username: str,
    email: str,
    password_hash: str,
) -> User:

    user_count = db.scalar(
        select(func.count()).select_from(User)
    )

    role = "admin" if user_count == 0 else "user"

    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role=role,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


from sqlalchemy import select
from sqlalchemy.orm import Session

from app.user.user_model import User


def get_user_by_id(
    db: Session,
    user_id: int,
) -> User | None:
    statement = select(User).where(
        User.id == user_id
    )

    return db.execute(
        statement
    ).scalar_one_or_none()
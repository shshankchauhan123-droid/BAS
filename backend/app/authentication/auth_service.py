from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.user.user_model import User
from app.user.user_repository import (
    get_user_by_email,
    get_user_by_username,
)


def signup_user(
    db: Session,
    username: str,
    email: str,
    password: str,
) -> User:

    username = username.strip()
    email = email.strip().lower()

    if get_user_by_username(db, username):
        raise ValueError("Username already exists")

    if get_user_by_email(db, email):
        raise ValueError("Email already exists")

    password_hash = hash_password(password)

    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role="user",
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def login_user(
    db: Session,
    username: str,
    password: str,
) -> User:

    cleaned = username.strip()

    user = get_user_by_username(
        db=db,
        username=cleaned,
    )

    if not user:
        user = get_user_by_email(
            db=db,
            email=cleaned,
        )

    if not user:
        raise ValueError(
            "Invalid username or password"
        )

    if not verify_password(
        password,
        user.password_hash,
    ):
        raise ValueError(
            "Invalid username or password"
        )

    if not user.is_active:
        raise ValueError(
            "User account is inactive"
        )

    if (
        user.client_id
        and user.client
        and not user.client.is_active
    ):
        raise ValueError(
            "Access denied. Your company account has been deactivated by administrator."
        )

    return user
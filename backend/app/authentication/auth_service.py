from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.user.user_model import User
from app.user.user_repository import (
    create_user,
    get_user_by_email,
    get_user_by_username,
)


def signup_user(
    db: Session,
    username: str,
    email: str,
    password: str,
) -> User:
    existing_username = get_user_by_username(db, username)

    if existing_username:
        raise ValueError("Username already exists")

    existing_email = get_user_by_email(db, email)

    if existing_email:
        raise ValueError("Email already exists")

    password_hash = hash_password(password)

    user = create_user(
        db=db,
        username=username,
        email=email,
        password_hash=password_hash,
    )

    return user


def login_user(
    db: Session,
    username: str,
    password: str,
) -> User:
    user = get_user_by_username(
        db=db,
        username=username,
    )

    if not user:
        raise ValueError("Invalid username or password")

    if not verify_password(
        password,
        user.password_hash,
    ):
        raise ValueError("Invalid username or password")

    if not user.is_active:
        raise ValueError("User account is inactive")

    return user
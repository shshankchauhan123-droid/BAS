from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.user.user_model import User
from app.user.user_repository import (
    create_user,
    get_user_by_email,
    get_user_by_id,
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
        raise ValueError("Invalid username or password")

    if not verify_password(
        password,
        user.password_hash,
    ):
        raise ValueError("Invalid username or password")

    if not user.is_active:
        raise ValueError("User account is inactive")

    # Check if the user's company is active
    if user.client_id and user.client and not user.client.is_active:
        raise ValueError(
            "Access denied. Your company account has been deactivated by administrator."
        )

    return user


def update_first_login_password(
    db: Session,
    user_id: int,
    new_password: str,
) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    user.password_hash = hash_password(new_password)
    user.first_login = False
    db.commit()
    db.refresh(user)
    return user


def dismiss_first_login_prompt(
    db: Session,
    user_id: int,
) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    user.first_login = False
    db.commit()
    db.refresh(user)
    return user
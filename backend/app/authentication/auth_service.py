from sqlalchemy.orm import Session

from app.client.client_repository import get_client_by_code
from app.core.security import hash_password, verify_password
from app.user.user_model import User
from app.user.user_repository import (
    get_user_by_email,
    get_user_by_username,
    get_user_by_username_and_client,
    get_users_by_username,
)


def signup_user(
    db: Session,
    username: str,
    email: str,
    password: str,
) -> User:

    username = username.strip()
    email = email.strip().lower()

    if get_user_by_username_and_client(db, username, client_id=None):
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
    company_code: str | None = None,
) -> User:

    cleaned = username.strip()
    code = company_code.strip() if company_code else None

    user = None

    # 1. Company Code provided -> Explicit tenant-scoped lookup
    if code:
        client = get_client_by_code(db, code)
        if not client:
            raise ValueError("Invalid company code or credentials")

        user = get_user_by_username_and_client(db, cleaned, client.id)

        # Also support email under this client if email was entered with company code
        if not user and "@" in cleaned:
            email_user = get_user_by_email(db, cleaned)
            if email_user and email_user.client_id == client.id:
                user = email_user

        if not user:
            raise ValueError("Invalid username or password")

    # 2. Company Code NOT provided
    else:
        # Check if an email was entered (emails are globally unique)
        if "@" in cleaned:
            user = get_user_by_email(db, cleaned)

        if not user:
            # Check if this is Super Admin / global user (client_id IS NULL)
            super_user = get_user_by_username_and_client(db, cleaned, client_id=None)
            if super_user:
                user = super_user

        if not user:
            # Check by email directly (in case username had no '@')
            email_user = get_user_by_email(db, cleaned)
            if email_user:
                user = email_user

        if not user:
            # Search for candidate users across all clients
            candidate_users = get_users_by_username(db, cleaned)
            if len(candidate_users) == 0:
                raise ValueError("Invalid username or password")
            elif len(candidate_users) == 1:
                # Single user globally with this username
                user = candidate_users[0]
            else:
                # Multiple tenants have a user with this username
                # Business Rule: Do NOT perform password matching across multiple users!
                raise ValueError(
                    "Multiple company accounts found with this username. Please enter your Company Code."
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

    # Record successful login in audit log
    try:
        from app.audit.audit_service import record_audit_log

        record_audit_log(
            db=db,
            action="USER_LOGIN",
            entity_type="user",
            entity_id=str(user.id),
            entity_name=user.username,
            description=f"User '{user.username}' logged in successfully",
            actor=user,
            client_id=user.client_id,
            details={"role": str(user.role).lower(), "email": user.email},
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Failed to record login audit log: %s", exc)

    return user


def change_first_login_password(
    db: Session,
    user: User,
    new_password: str,
) -> User:

    if not user.first_login:
        raise ValueError("First login password change is not required or already completed")

    if not new_password or len(new_password) < 6:
        raise ValueError("Password must be at least 6 characters long")

    if len(new_password) > 128:
        raise ValueError("Password must not exceed 128 characters")

    user.password_hash = hash_password(new_password)
    user.first_login = False

    db.commit()
    db.refresh(user)

    try:
        from app.audit.audit_service import record_audit_log

        record_audit_log(
            db=db,
            action="USER_FIRST_LOGIN_PASSWORD_CHANGE",
            entity_type="user",
            entity_id=str(user.id),
            entity_name=user.username,
            description=f"User '{user.username}' changed password on first login",
            actor=user,
            client_id=user.client_id,
            details={"role": str(user.role).lower(), "email": user.email},
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Failed to record first-login password change audit log: %s", exc)

    return user


def dismiss_first_login(
    db: Session,
    user: User,
) -> User:

    user.first_login = False

    db.commit()
    db.refresh(user)

    try:
        from app.audit.audit_service import record_audit_log

        record_audit_log(
            db=db,
            action="USER_DISMISS_FIRST_LOGIN",
            entity_type="user",
            entity_id=str(user.id),
            entity_name=user.username,
            description=f"User '{user.username}' kept current password on first login",
            actor=user,
            client_id=user.client_id,
            details={"role": str(user.role).lower(), "email": user.email},
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Failed to record dismiss first-login audit log: %s", exc)

    return user
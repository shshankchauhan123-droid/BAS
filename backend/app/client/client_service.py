from sqlalchemy.orm import Session

from app.client.client_model import Client
from app.client.client_repository import (
    count_active_users_in_client,
    count_users_in_client,
    create_client,
    get_all_clients,
    get_all_clients_with_user_counts,
    get_client_admin,
    get_client_admins_by_client_ids,
    get_client_by_code,
    get_client_by_id,
    get_client_by_name,
    update_client_max_users,
    update_client_status,
)
from app.client.client_schema import ClientAdminCreate, ClientCreateRequest
from app.core.roles import CLIENT_ADMIN_ROLE
from app.core.security import hash_password
from app.user.user_model import User
from app.user.user_repository import (
    get_user_by_email,
    get_user_by_username,
)


def create_client_with_admin(
    db: Session,
    data: ClientCreateRequest,
) -> tuple[Client, User]:
    # 1. Validate Client Name
    existing_name = get_client_by_name(db, data.name)
    if existing_name:
        raise ValueError(f"A client company with name '{data.name}' already exists.")

    # 2. Validate Company Code
    existing_code = get_client_by_code(db, data.company_code)
    if existing_code:
        raise ValueError(
            f"A client company with code '{data.company_code.upper()}' already exists."
        )

    # 3. Validate Admin Username & Email
    admin_data: ClientAdminCreate = data.admin
    cleaned_username = admin_data.username.strip()
    cleaned_email = admin_data.email.strip().lower()

    if get_user_by_username(db, cleaned_username):
        raise ValueError(f"Username '{cleaned_username}' is already taken.")

    if get_user_by_email(db, cleaned_email):
        raise ValueError(f"Email '{cleaned_email}' is already in use.")

    try:
        # 4. Create Client
        client = create_client(
            db=db,
            name=data.name,
            company_code=data.company_code,
            max_users=data.max_users,
        )

        # 5. Create Client Admin User
        password_hash = hash_password(admin_data.password)
        admin_user = User(
            client_id=client.id,
            username=cleaned_username,
            email=cleaned_email,
            password_hash=password_hash,
            role=CLIENT_ADMIN_ROLE,
            is_active=True,
            first_login=True,  # Will prompt to change password on first login
        )
        db.add(admin_user)
        db.commit()
        db.refresh(client)
        db.refresh(admin_user)

        return client, admin_user

    except Exception:
        db.rollback()
        raise


def get_all_clients_with_stats(db: Session) -> list[dict]:
    client_rows = get_all_clients_with_user_counts(db)
    if not client_rows:
        return []

    client_ids = [client.id for client, _, _ in client_rows]
    admins_map = get_client_admins_by_client_ids(db, client_ids)

    result = []
    for client, total_users, active_users in client_rows:
        admin_user = admins_map.get(client.id)
        result.append(
            {
                "client": client,
                "current_users_count": total_users,
                "active_users": active_users,
                "admin_email": admin_user.email if admin_user else None,
                "admin_username": admin_user.username if admin_user else None,
            }
        )
    return result


def get_client_by_id_with_stats(db: Session, client_id: int) -> dict:
    client = get_client_by_id(db, client_id)
    if not client:
        raise ValueError(f"Client with ID {client_id} not found.")

    user_count = count_users_in_client(db, client.id)
    active_user_count = count_active_users_in_client(db, client.id)
    admin_user = get_client_admin(db, client.id)
    return {
        "client": client,
        "current_users_count": user_count,
        "active_users": active_user_count,
        "admin_email": admin_user.email if admin_user else None,
        "admin_username": admin_user.username if admin_user else None,
    }


def set_client_status(db: Session, client_id: int, is_active: bool) -> dict:
    client = get_client_by_id(db, client_id)
    if not client:
        raise ValueError(f"Client with ID {client_id} not found.")

    updated_client = update_client_status(db, client, is_active)
    user_count = count_users_in_client(db, client.id)
    active_user_count = count_active_users_in_client(db, client.id)
    admin_user = get_client_admin(db, client.id)
    return {
        "client": updated_client,
        "current_users_count": user_count,
        "active_users": active_user_count,
        "admin_email": admin_user.email if admin_user else None,
        "admin_username": admin_user.username if admin_user else None,
    }


def set_client_max_users(db: Session, client_id: int, max_users: int) -> dict:
    client = get_client_by_id(db, client_id)
    if not client:
        raise ValueError(f"Client with ID {client_id} not found.")

    user_count = count_users_in_client(db, client.id)
    if max_users < user_count:
        raise ValueError(
            f"Cannot decrease limit to {max_users}. Client already has {user_count} registered users."
        )

    updated_client = update_client_max_users(db, client, max_users)
    active_user_count = count_active_users_in_client(db, client.id)
    admin_user = get_client_admin(db, client.id)
    return {
        "client": updated_client,
        "current_users_count": user_count,
        "active_users": active_user_count,
        "admin_email": admin_user.email if admin_user else None,
        "admin_username": admin_user.username if admin_user else None,
    }


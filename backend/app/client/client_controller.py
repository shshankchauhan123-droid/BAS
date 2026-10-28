from sqlalchemy.orm import Session

from app.client.client_schema import (
    ClientCreateRequest,
    ClientListResponse,
    ClientResponse,
    ClientUpdateMaxUsersRequest,
    ClientUpdateStatusRequest,
    ClientUpdateRequest,
)
from app.client.client_service import (
    create_client_with_admin,
    delete_client_safely,
    get_all_clients_with_stats,
    get_client_by_id_with_stats,
    set_client_max_users,
    set_client_status,
    update_client_details,
)
from app.user.user_model import User


def _format_client_response(data: dict) -> ClientResponse:
    client = data["client"]
    user_count = data.get("current_users_count", 0)
    active_users = data.get("active_users", 0)
    return ClientResponse(
        id=client.id,
        name=client.name,
        company_code=client.company_code,
        max_users=client.max_users,
        is_active=client.is_active,
        current_users_count=user_count,
        active_users=active_users,
        admin_email=data.get("admin_email"),
        admin_username=data.get("admin_username"),
        created_at=client.created_at,
        updated_at=client.updated_at,
    )


def create_client_controller(
    db: Session,
    data: ClientCreateRequest,
) -> ClientResponse:
    client, admin_user = create_client_with_admin(db, data)
    return ClientResponse(
        id=client.id,
        name=client.name,
        company_code=client.company_code,
        max_users=client.max_users,
        is_active=client.is_active,
        current_users_count=1,  # The admin user counts as 1
        active_users=1 if admin_user.is_active else 0,
        admin_email=admin_user.email,
        admin_username=admin_user.username,
        created_at=client.created_at,
        updated_at=client.updated_at,
    )


def list_clients_controller(db: Session) -> ClientListResponse:
    client_stats = get_all_clients_with_stats(db)
    items = [_format_client_response(item) for item in client_stats]
    return ClientListResponse(items=items, clients=items, total=len(items))


def get_client_controller(db: Session, client_id: int) -> ClientResponse:
    data = get_client_by_id_with_stats(db, client_id)
    return _format_client_response(data)


def update_client_status_controller(
    db: Session,
    client_id: int,
    data: ClientUpdateStatusRequest,
) -> ClientResponse:
    result = set_client_status(db, client_id, data.is_active)
    return _format_client_response(result)


def update_client_max_users_controller(
    db: Session,
    client_id: int,
    data: ClientUpdateMaxUsersRequest,
) -> ClientResponse:
    result = set_client_max_users(db, client_id, data.max_users)
    return _format_client_response(result)


def update_client_controller(
    db: Session,
    client_id: int,
    data: ClientUpdateRequest,
    actor: User | None = None,
) -> ClientResponse:
    result = update_client_details(db=db, client_id=client_id, data=data, actor=actor)
    return _format_client_response(result)


def delete_client_controller(
    db: Session,
    client_id: int,
    actor: User | None = None,
) -> dict:
    return delete_client_safely(db=db, client_id=client_id, actor=actor)

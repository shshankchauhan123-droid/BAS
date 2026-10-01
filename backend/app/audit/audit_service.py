from datetime import datetime, timezone
import logging
from sqlalchemy.orm import Session

from app.audit.audit_model import AuditLog
from app.audit.audit_repository import (
    create_audit_log,
    get_audit_logs,
    get_audit_stats,
)
from app.core.roles import ADMIN_ROLE, CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE, USER_ROLE
from app.user.user_model import User

logger = logging.getLogger(__name__)

SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "secret_key",
    "jwt",
    "api_key",
}


def sanitize_details(data: dict | None) -> dict:
    """
    Ensure no sensitive credentials or keys are stored in audit details.
    """
    if not data or not isinstance(data, dict):
        return {}

    sanitized = {}
    for key, value in data.items():
        if any(s in key.lower() for s in SENSITIVE_KEYS):
            continue
        if isinstance(value, dict):
            sanitized[key] = sanitize_details(value)
        else:
            sanitized[key] = value
    return sanitized


def record_audit_log(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str | int,
    entity_name: str | None,
    description: str,
    actor: User | None = None,
    details: dict | None = None,
    client_id: int | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """
    Backend-controlled helper to record an append-only audit log entry.
    All actor information is derived strictly from the backend User object.
    """
    safe_details = sanitize_details(details)

    if actor is not None:
        user_id = actor.id
        user_email = actor.email
        user_name = actor.username
        user_role = str(actor.role).lower()
        effective_client_id = client_id if client_id is not None else actor.client_id
    else:
        user_id = None
        user_email = "system@worker"
        user_name = "System Worker"
        user_role = "system"
        effective_client_id = client_id

    log_entry = AuditLog(
        client_id=effective_client_id,
        user_id=user_id,
        user_email=user_email,
        user_name=user_name,
        user_role=user_role,
        action=action.strip(),
        entity_type=entity_type.strip().lower(),
        entity_id=str(entity_id).strip(),
        entity_name=entity_name.strip() if entity_name else None,
        description=description.strip(),
        details=safe_details,
        ip_address=ip_address,
    )

    return create_audit_log(db=db, audit_log=log_entry)


def list_audit_logs_for_actor(
    db: Session,
    actor: User,
    client_id: int | None = None,
    user_id: int | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    start_date: datetime | str | None = None,
    end_date: datetime | str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AuditLog], int, int]:
    """
    List audit logs enforcing strict role and multi-tenant client isolation rules.
    - SuperAdmin: Can see all clients or filter by client_id.
    - Client Admin: STRICTLY limited to own company logs (actor.client_id).
    - Normal User: Forbidden (403).
    """
    actor_role = str(actor.role).lower()

    if actor_role == USER_ROLE:
        raise PermissionError("Access denied. Regular users cannot access global audit logs.")

    if actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id:
            raise PermissionError("Client admin is not associated with any client company.")

        # Never trust client_id from query parameters for Client Admin
        if client_id is not None and client_id != actor.client_id:
            raise PermissionError("Access denied: You cannot view audit logs of another company.")

        scoped_client_id = actor.client_id

    elif actor_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        # SuperAdmin can optionally filter by client_id or view all
        scoped_client_id = client_id

    else:
        raise PermissionError("Access denied.")

    # Parse date strings if needed
    parsed_start = None
    parsed_end = None
    if isinstance(start_date, str) and start_date.strip():
        try:
            parsed_start = datetime.fromisoformat(start_date.strip())
        except ValueError:
            pass
    elif isinstance(start_date, datetime):
        parsed_start = start_date

    if isinstance(end_date, str) and end_date.strip():
        try:
            parsed_end = datetime.fromisoformat(end_date.strip())
        except ValueError:
            pass
    elif isinstance(end_date, datetime):
        parsed_end = end_date

    return get_audit_logs(
        db=db,
        client_id=scoped_client_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        start_date=parsed_start,
        end_date=parsed_end,
        page=page,
        page_size=page_size,
    )


def get_audit_stats_for_actor(
    db: Session,
    actor: User,
    client_id: int | None = None,
) -> dict:
    """
    Retrieve audit statistics with multi-tenant client isolation.
    """
    actor_role = str(actor.role).lower()

    if actor_role == USER_ROLE:
        raise PermissionError("Access denied. Regular users cannot access audit statistics.")

    if actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id:
            raise PermissionError("Client admin is not associated with any client company.")

        if client_id is not None and client_id != actor.client_id:
            raise PermissionError("Access denied: You cannot view audit statistics of another company.")

        scoped_client_id = actor.client_id

    elif actor_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        scoped_client_id = client_id
    else:
        raise PermissionError("Access denied.")

    return get_audit_stats(db=db, client_id=scoped_client_id)

from datetime import datetime, timezone
import logging
from sqlalchemy.orm import Session

from app.audit.audit_model import AuditLog
from app.audit.audit_repository import (
    count_distinct_logins_today_for_client,
    create_audit_log,
    get_audit_logs,
    get_audit_stats,
    get_last_login_for_user,
    get_user_activity_logs,
    get_user_activity_summary,
)
from app.client.client_repository import get_all_clients_with_user_counts, get_client_by_id
from app.core.roles import ADMIN_ROLE, CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE, USER_ROLE
from app.user.user_model import User
from app.user.user_repository import get_users_by_client_id, get_user_by_id

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


def deduce_module(action: str, entity_type: str) -> str:
    act = (action or "").upper()
    ent = (entity_type or "").upper()
    if "LOGIN" in act or "LOGOUT" in act or "AUTH" in ent or "PASSWORD" in act:
        return "AUTH"
    if "CASE" in act or "CASE" in ent:
        return "CASE"
    if "FILE" in act or "UPLOAD" in act or "FILE" in ent or "WORKBOOK" in ent:
        return "UPLOAD"
    if "REPORT" in act or "REPORT" in ent or "ANALYSIS" in act:
        return "REPORT"
    if "USER" in act or "CLIENT" in act or "IO" in act or "MASTER" in act or ent in {"USER", "CLIENT", "IO_MASTER"}:
        return "ADMIN"
    if "TICKET" in act or "SUPPORT" in act or "SUPPORT" in ent:
        return "SUPPORT"
    if "PAGE" in act or "DASHBOARD" in act:
        return "DASHBOARD"
    return "GENERAL"


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
    module: str | None = None,
    status: str | None = "SUCCESS",
    user_agent: str | None = None,
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

    effective_module = module if module else deduce_module(action, entity_type)
    effective_status = (
        status
        if status
        else ("FAILED" if "FAIL" in action.upper() or "ERROR" in action.upper() else "SUCCESS")
    )

    log_entry = AuditLog(
        client_id=effective_client_id,
        user_id=user_id,
        user_email=user_email,
        user_name=user_name,
        user_role=user_role,
        action=action.strip(),
        module=effective_module.strip().upper(),
        status=effective_status.strip().upper(),
        entity_type=entity_type.strip().lower(),
        entity_id=str(entity_id).strip(),
        entity_name=entity_name.strip() if entity_name else None,
        description=description.strip(),
        details=safe_details,
        ip_address=ip_address,
        user_agent=user_agent,
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


def get_today_login_count_for_client(db: Session, client_id: int) -> int:
    return count_distinct_logins_today_for_client(db=db, client_id=client_id)


def get_user_last_login(db: Session, user_id: int) -> datetime | None:
    """
    Get the timestamp of the last successful login for a given user ID.
    Derived strictly from the audit log repository.
    """
    return get_last_login_for_user(db=db, user_id=user_id)


def list_my_activity_logs(
    db: Session,
    user: User,
    page: int = 1,
    page_size: int = 20,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: datetime | str | None = None,
    end_date: datetime | str | None = None,
    search: str | None = None,
) -> tuple[list[AuditLog], int, int]:
    """
    List the authenticated user's own activity logs.
    Strictly scoped to user.id - role-independent ownership.
    """
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

    return get_user_activity_logs(
        db=db,
        user_id=user.id,
        page=page,
        page_size=page_size,
        module=module,
        action=action,
        status=status,
        start_date=parsed_start,
        end_date=parsed_end,
        search=search,
    )


def get_my_activity_summary(
    db: Session,
    user: User,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: datetime | str | None = None,
    end_date: datetime | str | None = None,
    search: str | None = None,
) -> dict:
    """
    Retrieve statistics and chart aggregations for the authenticated user's activity.
    """
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

    return get_user_activity_summary(
        db=db,
        user_id=user.id,
        module=module,
        action=action,
        status=status,
        start_date=parsed_start,
        end_date=parsed_end,
        search=search,
    )


def list_audit_companies_for_actor(db: Session, actor: User) -> list[dict]:
    """
    List active companies for audit selection (Super Admin only).
    """
    actor_role = str(actor.role).lower()
    if actor_role not in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        raise PermissionError("Access denied. Only Super Admin can view all companies.")

    clients_data = get_all_clients_with_user_counts(db)
    return [
        {
            "id": client.id,
            "name": client.name,
            "company_code": client.company_code,
            "is_active": client.is_active,
            "user_count": total_users,
        }
        for client, total_users, _ in clients_data
    ]


def list_company_users_for_actor(
    db: Session,
    actor: User,
    company_id: int | None = None,
) -> list[dict]:
    """
    List users belonging to a company with role authorization:
    - Super Admin: can list users for any valid company_id.
    - Client Admin: can only list users for their own company (actor.client_id).
    - Regular Users: denied.
    """
    actor_role = str(actor.role).lower()

    if actor_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        if company_id is None:
            raise ValueError("company_id is required for Super Admin to list company users.")
        target_client_id = company_id
        client = get_client_by_id(db, company_id)
        if not client:
            raise ValueError(f"Company #{company_id} not found.")
        company_name = client.name
    elif actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id:
            raise PermissionError("Client account is not linked to any company.")
        if company_id is not None and company_id != actor.client_id:
            raise PermissionError("Access denied: You cannot view users belonging to another company.")
        target_client_id = actor.client_id
        company_name = actor.client_name
    else:
        raise PermissionError("Access denied. Only Client and Super Admin roles can access company users.")

    users = get_users_by_client_id(db, target_client_id)
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "client_id": u.client_id,
            "company_name": u.client_name or company_name,
        }
        for u in users
    ]


def list_user_activity_logs_for_actor(
    db: Session,
    actor: User,
    target_user_id: int,
    company_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: datetime | str | None = None,
    end_date: datetime | str | None = None,
    search: str | None = None,
) -> tuple[list[AuditLog], int, int]:
    """
    Retrieve activity logs of a specific target user with company authorization:
    - Client Admin: target_user MUST belong to actor.client_id.
    - Super Admin: if company_id is provided, target_user MUST belong to that company.
    - Others: denied.
    """
    actor_role = str(actor.role).lower()
    target_user = get_user_by_id(db, target_user_id)
    if not target_user:
        raise ValueError(f"User #{target_user_id} not found.")

    if actor_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        if company_id is not None and target_user.client_id != company_id:
            raise PermissionError(f"User #{target_user_id} does not belong to company #{company_id}.")
    elif actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id or target_user.client_id != actor.client_id:
            raise PermissionError("Access denied: You cannot view audit logs of users belonging to another company.")
    else:
        raise PermissionError("Access denied. Only Client and Super Admin roles can view user audit logs.")

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

    return get_user_activity_logs(
        db=db,
        user_id=target_user.id,
        page=page,
        page_size=page_size,
        module=module,
        action=action,
        status=status,
        start_date=parsed_start,
        end_date=parsed_end,
        search=search,
    )


def get_user_activity_summary_for_actor(
    db: Session,
    actor: User,
    target_user_id: int,
    company_id: int | None = None,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: datetime | str | None = None,
    end_date: datetime | str | None = None,
    search: str | None = None,
) -> dict:
    """
    Retrieve statistics & charts of a specific target user with company authorization:
    - Client Admin: target_user MUST belong to actor.client_id.
    - Super Admin: if company_id is provided, target_user MUST belong to that company.
    - Others: denied.
    """
    actor_role = str(actor.role).lower()
    target_user = get_user_by_id(db, target_user_id)
    if not target_user:
        raise ValueError(f"User #{target_user_id} not found.")

    if actor_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        if company_id is not None and target_user.client_id != company_id:
            raise PermissionError(f"User #{target_user_id} does not belong to company #{company_id}.")
    elif actor_role == CLIENT_ADMIN_ROLE:
        if not actor.client_id or target_user.client_id != actor.client_id:
            raise PermissionError("Access denied: You cannot view audit statistics of users belonging to another company.")
    else:
        raise PermissionError("Access denied. Only Client and Super Admin roles can view user audit statistics.")

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

    return get_user_activity_summary(
        db=db,
        user_id=target_user.id,
        module=module,
        action=action,
        status=status,
        start_date=parsed_start,
        end_date=parsed_end,
        search=search,
    )



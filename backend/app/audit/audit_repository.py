from datetime import datetime, timezone
import math
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.audit.audit_model import AuditLog


def create_audit_log(
    db: Session,
    audit_log: AuditLog,
) -> AuditLog:
    """
    Append-only creation of an audit log entry.
    """
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log


def get_audit_logs(
    db: Session,
    client_id: int | None = None,
    user_id: int | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AuditLog], int, int]:
    """
    Query audit logs with database-level client isolation and pagination.
    Returns (items, total_count, total_pages).
    """
    query = db.query(AuditLog)

    # Database-level client isolation filter
    if client_id is not None:
        query = query.filter(AuditLog.client_id == client_id)

    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)

    if action:
        query = query.filter(AuditLog.action == action.strip())

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type.strip().lower())

    if entity_id:
        query = query.filter(AuditLog.entity_id == str(entity_id).strip())

    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)

    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    total_count = query.count()
    total_pages = max(1, math.ceil(total_count / page_size)) if total_count > 0 else 1

    # Default sort created_at DESC
    items = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return items, total_count, total_pages


def get_audit_stats(
    db: Session,
    client_id: int | None = None,
) -> dict:
    """
    Retrieve audit statistics scoped by client_id.
    """
    today_utc = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    base_query = db.query(AuditLog)
    if client_id is not None:
        base_query = base_query.filter(AuditLog.client_id == client_id)

    total_today = base_query.filter(AuditLog.created_at >= today_utc).count()
    case_activities = base_query.filter(AuditLog.entity_type == "case").count()
    file_uploads = base_query.filter(AuditLog.action == "FILE_UPLOADED").count()
    file_processing_failures = base_query.filter(
        AuditLog.action == "FILE_PROCESSING_FAILED"
    ).count()
    user_management_activities = base_query.filter(
        AuditLog.entity_type == "user"
    ).count()

    return {
        "total_today": total_today,
        "case_activities": case_activities,
        "file_uploads": file_uploads,
        "file_processing_failures": file_processing_failures,
        "user_management_activities": user_management_activities,
    }


def count_distinct_logins_today_for_client(
    db: Session,
    client_id: int,
) -> int:
    """
    Count the number of distinct users who successfully logged in today for a specific client.
    """
    statement = (
        select(func.count(func.distinct(AuditLog.user_id)))
        .where(
            AuditLog.client_id == client_id,
            AuditLog.action == "USER_LOGIN",
            func.date(AuditLog.created_at) == func.current_date(),
        )
    )
    return db.scalar(statement) or 0

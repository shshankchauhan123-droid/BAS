from datetime import datetime, timezone
import math
from sqlalchemy.orm import Session
from sqlalchemy import func, select, case, or_

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


def get_last_login_for_user(
    db: Session,
    user_id: int,
) -> datetime | None:
    """
    Retrieve the most recent successful login timestamp for a specific user from audit logs.
    Only successful login events (action == 'USER_LOGIN') are considered.
    Returns None if no login record exists.
    """
    record = (
        db.query(AuditLog.created_at)
        .filter(
            AuditLog.user_id == user_id,
            func.upper(AuditLog.action) == "USER_LOGIN",
        )
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    if record and record[0]:
        return record[0]
    return None


def _apply_user_activity_filters(
    query,
    user_id: int,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
):
    query = query.filter(AuditLog.user_id == user_id)

    if module and module.strip():
        m = module.strip().upper()
        query = query.filter(func.upper(AuditLog.module) == m)

    if action and action.strip():
        a = action.strip()
        query = query.filter(AuditLog.action.ilike(f"%{a}%"))

    if status and status.strip():
        s = status.strip().upper()
        if s == "SUCCESS":
            query = query.filter(or_(AuditLog.status == "SUCCESS", AuditLog.status == None))
        else:
            query = query.filter(func.upper(AuditLog.status) == s)

    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)

    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.description.ilike(term),
                AuditLog.entity_name.ilike(term),
                AuditLog.action.ilike(term),
                AuditLog.entity_id.ilike(term),
                AuditLog.entity_type.ilike(term),
            )
        )

    return query


def get_user_activity_logs(
    db: Session,
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
) -> tuple[list[AuditLog], int, int]:
    base_query = db.query(AuditLog)
    filtered = _apply_user_activity_filters(
        base_query,
        user_id=user_id,
        module=module,
        action=action,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )

    total_count = filtered.count()
    total_pages = max(1, math.ceil(total_count / page_size)) if total_count > 0 else 1

    items = (
        filtered.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return items, total_count, total_pages


def get_user_activity_summary(
    db: Session,
    user_id: int,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
) -> dict:
    base_query = db.query(AuditLog)
    filtered = _apply_user_activity_filters(
        base_query,
        user_id=user_id,
        module=module,
        action=action,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )

    total_activities = filtered.count()

    failed_actions = filtered.filter(
        or_(func.upper(AuditLog.status) == "FAILED", AuditLog.action.ilike("%FAIL%"))
    ).count()
    successful_actions = max(0, total_activities - failed_actions)

    reports_generated = filtered.filter(
        or_(
            func.upper(AuditLog.module) == "REPORT",
            AuditLog.action.ilike("%REPORT%"),
            AuditLog.entity_type == "report",
        )
    ).count()

    cases_created_updated = filtered.filter(
        or_(
            AuditLog.action.in_(["CASE_CREATED", "CASE_UPDATED"]),
            AuditLog.action.ilike("%CASE_CREATE%"),
            AuditLog.action.ilike("%CASE_UPDATE%"),
        )
    ).count()

    login_sessions = filtered.filter(
        AuditLog.action.in_(["USER_LOGIN", "LOGIN"]),
        or_(AuditLog.status == "SUCCESS", AuditLog.status == None),
    ).count()

    date_col = func.date(AuditLog.created_at)
    trend_rows = (
        filtered.with_entities(
            date_col.label("day"),
            func.count(AuditLog.id).label("total"),
            func.sum(
                case(
                    (or_(func.upper(AuditLog.status) == "FAILED", AuditLog.action.ilike("%FAIL%")), 0),
                    else_=1,
                )
            ).label("success_count"),
            func.sum(
                case(
                    (or_(func.upper(AuditLog.status) == "FAILED", AuditLog.action.ilike("%FAIL%")), 1),
                    else_=0,
                )
            ).label("failed_count"),
        )
        .group_by(date_col)
        .order_by(date_col.asc())
        .all()
    )

    activity_trend = [
        {
            "date": str(row.day),
            "count": int(row.total or 0),
            "success": int(row.success_count or 0),
            "failed": int(row.failed_count or 0),
        }
        for row in trend_rows
    ]

    module_rows = (
        filtered.with_entities(
            func.coalesce(AuditLog.module, "GENERAL").label("mod"),
            func.count(AuditLog.id).label("cnt"),
        )
        .group_by("mod")
        .order_by(func.count(AuditLog.id).desc())
        .all()
    )
    by_module = [{"name": str(r.mod), "count": int(r.cnt)} for r in module_rows]

    action_rows = (
        filtered.with_entities(
            AuditLog.action.label("act"),
            func.count(AuditLog.id).label("cnt"),
        )
        .group_by("act")
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
        .all()
    )
    by_action = [{"name": str(r.act), "count": int(r.cnt)} for r in action_rows]

    user_all_logs = db.query(AuditLog).filter(AuditLog.user_id == user_id)
    avail_mods = [
        r[0]
        for r in user_all_logs.with_entities(func.distinct(func.coalesce(AuditLog.module, "GENERAL"))).all()
        if r[0]
    ]
    avail_acts = [
        r[0]
        for r in user_all_logs.with_entities(func.distinct(AuditLog.action)).all()
        if r[0]
    ]

    return {
        "stats": {
            "total_activities": total_activities,
            "successful_actions": successful_actions,
            "failed_actions": failed_actions,
            "reports_generated": reports_generated,
            "cases_created_updated": cases_created_updated,
            "login_sessions": login_sessions,
        },
        "activity_trend": activity_trend,
        "by_module": by_module,
        "by_action": by_action,
        "by_status": {
            "SUCCESS": successful_actions,
            "FAILED": failed_actions,
        },
        "available_modules": sorted(avail_mods),
        "available_actions": sorted(avail_acts),
    }


from datetime import datetime
from sqlalchemy.orm import Session

from app.audit.audit_schema import (
    AuditLogListResponse,
    AuditLogResponse,
    AuditStatsData,
    AuditStatsResponse,
)
from app.audit.audit_service import (
    get_audit_stats_for_actor,
    list_audit_logs_for_actor,
)
from app.user.user_model import User


def list_audit_logs_controller(
    db: Session,
    actor: User,
    client_id: int | None = None,
    user_id: int | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> AuditLogListResponse:
    items, total, total_pages = list_audit_logs_for_actor(
        db=db,
        actor=actor,
        client_id=client_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )

    return AuditLogListResponse(
        success=True,
        message="Audit logs retrieved successfully",
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=[AuditLogResponse.model_validate(item) for item in items],
    )


def get_audit_stats_controller(
    db: Session,
    actor: User,
    client_id: int | None = None,
) -> AuditStatsResponse:
    stats = get_audit_stats_for_actor(
        db=db,
        actor=actor,
        client_id=client_id,
    )

    return AuditStatsResponse(
        success=True,
        message="Audit statistics retrieved successfully",
        data=AuditStatsData(**stats),
    )

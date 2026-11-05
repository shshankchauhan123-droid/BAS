from datetime import datetime
from sqlalchemy.orm import Session

from app.audit.audit_schema import (
    AuditCompanyItem,
    AuditCompanyListResponse,
    AuditCompanyUserItem,
    AuditCompanyUserListResponse,
    AuditLogListResponse,
    AuditLogResponse,
    AuditStatsData,
    AuditStatsResponse,
    LogActivityRequest,
    UserActivitySummaryResponse,
    UserActivitySummaryStats,
)
from app.audit.audit_service import (
    get_audit_stats_for_actor,
    get_my_activity_summary,
    get_user_activity_summary_for_actor,
    list_audit_companies_for_actor,
    list_audit_logs_for_actor,
    list_company_users_for_actor,
    list_my_activity_logs,
    list_user_activity_logs_for_actor,
    record_audit_log,
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


def list_my_activity_logs_controller(
    db: Session,
    actor: User,
    page: int = 1,
    page_size: int = 20,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    search: str | None = None,
) -> AuditLogListResponse:
    items, total, total_pages = list_my_activity_logs(
        db=db,
        user=actor,
        page=page,
        page_size=page_size,
        module=module,
        action=action,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )

    return AuditLogListResponse(
        success=True,
        message="User activity logs retrieved successfully",
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=[AuditLogResponse.model_validate(item) for item in items],
    )


def get_my_activity_summary_controller(
    db: Session,
    actor: User,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    search: str | None = None,
) -> UserActivitySummaryResponse:
    summary_data = get_my_activity_summary(
        db=db,
        user=actor,
        module=module,
        action=action,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )

    stats_dict = summary_data.get("stats", {})
    if isinstance(stats_dict, dict):
        if "cases_created_updated" in stats_dict and "cases_modified" not in stats_dict:
            stats_dict["cases_modified"] = stats_dict["cases_created_updated"]

    activity_trend = summary_data.get("activity_trend", [])
    by_module = summary_data.get("by_module", [])
    by_action = summary_data.get("by_action", [])
    by_status = summary_data.get("by_status", {})

    return UserActivitySummaryResponse(
        success=True,
        message="User activity summary retrieved successfully",
        stats=UserActivitySummaryStats(**stats_dict),
        activity_trend=activity_trend,
        daily_trend=activity_trend,
        by_module=by_module,
        module_breakdown=by_module,
        by_action=by_action,
        action_breakdown=by_action,
        by_status=by_status,
        status_breakdown=by_status,
        available_modules=summary_data.get("available_modules", []),
        available_actions=summary_data.get("available_actions", []),
    )


def record_user_activity_controller(
    db: Session,
    actor: User,
    data: LogActivityRequest,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLogResponse:
    log_entry = record_audit_log(
        db=db,
        action=data.action,
        module=data.module,
        entity_type=data.entity_type,
        entity_id=data.entity_id or "0",
        entity_name=data.entity_name,
        description=data.description,
        actor=actor,
        details=data.details,
        ip_address=ip_address,
        user_agent=user_agent,
        status=data.status,
    )
    return AuditLogResponse.model_validate(log_entry)


def list_audit_companies_controller(
    db: Session,
    actor: User,
) -> AuditCompanyListResponse:
    companies = list_audit_companies_for_actor(db=db, actor=actor)
    return AuditCompanyListResponse(
        success=True,
        message="Companies retrieved successfully",
        data=[AuditCompanyItem(**c) for c in companies],
    )


def list_company_users_controller(
    db: Session,
    actor: User,
    company_id: int | None = None,
) -> AuditCompanyUserListResponse:
    users = list_company_users_for_actor(db=db, actor=actor, company_id=company_id)
    return AuditCompanyUserListResponse(
        success=True,
        message="Company users retrieved successfully",
        data=[AuditCompanyUserItem(**u) for u in users],
    )


def list_target_user_activity_logs_controller(
    db: Session,
    actor: User,
    target_user_id: int,
    company_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    search: str | None = None,
) -> AuditLogListResponse:
    items, total, total_pages = list_user_activity_logs_for_actor(
        db=db,
        actor=actor,
        target_user_id=target_user_id,
        company_id=company_id,
        page=page,
        page_size=page_size,
        module=module,
        action=action,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )
    return AuditLogListResponse(
        success=True,
        message="User activity logs retrieved successfully",
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=[AuditLogResponse.model_validate(item) for item in items],
    )


def get_target_user_activity_summary_controller(
    db: Session,
    actor: User,
    target_user_id: int,
    company_id: int | None = None,
    module: str | None = None,
    action: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    search: str | None = None,
) -> UserActivitySummaryResponse:
    summary_data = get_user_activity_summary_for_actor(
        db=db,
        actor=actor,
        target_user_id=target_user_id,
        company_id=company_id,
        module=module,
        action=action,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )

    stats_dict = summary_data.get("stats", {})
    if isinstance(stats_dict, dict):
        if "cases_created_updated" in stats_dict and "cases_modified" not in stats_dict:
            stats_dict["cases_modified"] = stats_dict["cases_created_updated"]

    activity_trend = summary_data.get("activity_trend", [])
    by_module = summary_data.get("by_module", [])
    by_action = summary_data.get("by_action", [])
    by_status = summary_data.get("by_status", {})

    return UserActivitySummaryResponse(
        success=True,
        message="User activity summary retrieved successfully",
        stats=UserActivitySummaryStats(**stats_dict),
        activity_trend=activity_trend,
        daily_trend=activity_trend,
        by_module=by_module,
        module_breakdown=by_module,
        by_action=by_action,
        action_breakdown=by_action,
        by_status=by_status,
        status_breakdown=by_status,
        available_modules=summary_data.get("available_modules", []),
        available_actions=summary_data.get("available_actions", []),
    )


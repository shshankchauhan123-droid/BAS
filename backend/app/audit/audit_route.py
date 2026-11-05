from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy.orm import Session

from app.audit.audit_controller import (
    get_audit_stats_controller,
    get_my_activity_summary_controller,
    get_target_user_activity_summary_controller,
    list_audit_companies_controller,
    list_audit_logs_controller,
    list_company_users_controller,
    list_my_activity_logs_controller,
    list_target_user_activity_logs_controller,
    record_user_activity_controller,
)
from app.audit.audit_schema import (
    AuditCompanyListResponse,
    AuditCompanyUserListResponse,
    AuditLogListResponse,
    AuditLogResponse,
    AuditStatsResponse,
    LogActivityRequest,
    UserActivitySummaryResponse,
)
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.user.user_model import User

router = APIRouter(
    prefix="/api/v1/audit-logs",
    tags=["Audit Logs & Activity Trail"],
)

activity_router = APIRouter(
    prefix="/api/v1/activity-logs",
    tags=["User Activity Logs"],
)


# ============================================================
# PERSONAL USER ACTIVITY LOGS (AVAILABLE TO ALL USER ROLES)
# ============================================================

@router.get(
    "/me",
    response_model=AuditLogListResponse,
    status_code=http_status.HTTP_200_OK,
    summary="List authenticated user's own activity logs with filters and pagination",
)
def get_my_activity_logs_route(
    request: Request,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    module: str | None = Query(default=None, description="Filter by module (e.g. AUTH, CASE, UPLOAD, REPORT, ADMIN)"),
    action: str | None = Query(default=None, description="Filter by action name"),
    status: str | None = Query(default=None, description="Filter by status (SUCCESS, FAILED)"),
    start_date: str | None = Query(default=None, description="Start date filter (ISO format)"),
    end_date: str | None = Query(default=None, description="End date filter (ISO format)"),
    search: str | None = Query(default=None, description="Search term across description, entity, action"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_my_activity_logs_controller(
            db=db,
            actor=current_user,
            page=page,
            page_size=page_size,
            module=module,
            action=action,
            status=status,
            start_date=start_date,
            end_date=end_date,
            search=search,
        )
    except Exception as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/me/summary",
    response_model=UserActivitySummaryResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Get authenticated user's own activity statistics and chart analytics",
)
def get_my_activity_summary_route(
    module: str | None = Query(default=None, description="Filter by module"),
    action: str | None = Query(default=None, description="Filter by action"),
    status: str | None = Query(default=None, description="Filter by status"),
    start_date: str | None = Query(default=None, description="Start date filter (ISO format)"),
    end_date: str | None = Query(default=None, description="End date filter (ISO format)"),
    search: str | None = Query(default=None, description="Search term"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_my_activity_summary_controller(
            db=db,
            actor=current_user,
            module=module,
            action=action,
            status=status,
            start_date=start_date,
            end_date=end_date,
            search=search,
        )
    except Exception as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.post(
    "/activity",
    response_model=AuditLogResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Record an action performed by the authenticated user",
)
def record_activity_route(
    data: LogActivityRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        ip_address = request.client.host if request and request.client else None
        user_agent = request.headers.get("user-agent") if request else None

        return record_user_activity_controller(
            db=db,
            actor=current_user,
            data=data,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except Exception as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


# ============================================================
# GLOBAL / TENANT AUDIT LOGS (ADMIN & SUPERADMIN ONLY)
# ============================================================


@router.get(
    "/",
    response_model=AuditLogListResponse,
    status_code=http_status.HTTP_200_OK,
    summary="List paginated audit logs (Client Admin sees own company; Superadmin sees all or filtered)",
)
def get_audit_logs_route(
    request: Request,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    action: str | None = Query(default=None, description="Filter by action name (e.g. CASE_CREATED)"),
    entity_type: str | None = Query(default=None, description="Filter by entity type (case, file, user)"),
    entity_id: str | None = Query(default=None, description="Filter by entity ID"),
    user_id: int | None = Query(default=None, description="Filter by actor user ID"),
    client_id: int | None = Query(default=None, description="Filter by client ID (SuperAdmin only)"),
    start_date: str | None = Query(default=None, description="Start date filter (ISO format)"),
    end_date: str | None = Query(default=None, description="End date filter (ISO format)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # Normalize in case route is invoked directly in unit tests
        c_id = client_id if isinstance(client_id, int) else None
        u_id = user_id if isinstance(user_id, int) else None
        act = action if isinstance(action, str) else None
        e_type = entity_type if isinstance(entity_type, str) else None
        e_id = str(entity_id) if isinstance(entity_id, (str, int)) else None
        s_date = start_date if isinstance(start_date, str) else None
        e_date = end_date if isinstance(end_date, str) else None
        p_num = page if isinstance(page, int) else 1
        p_size = page_size if isinstance(page_size, int) else 20

        return list_audit_logs_controller(
            db=db,
            actor=current_user,
            client_id=c_id,
            user_id=u_id,
            action=act,
            entity_type=e_type,
            entity_id=e_id,
            start_date=s_date,
            end_date=e_date,
            page=p_num,
            page_size=p_size,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )



@router.get(
    "/stats",
    response_model=AuditStatsResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Get audit statistics (Client Admin for own company; Superadmin for global or filtered)",
)
def get_audit_stats_route(
    client_id: int | None = Query(default=None, description="Filter by client ID (SuperAdmin only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        c_id = client_id if isinstance(client_id, int) else None
        return get_audit_stats_controller(
            db=db,
            actor=current_user,
            client_id=c_id,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


# ============================================================
# ROLE-BASED AUDIT & ACTIVITY LOGS (CLIENT ADMIN & SUPERADMIN)
# ============================================================


@router.get(
    "/companies",
    response_model=AuditCompanyListResponse,
    status_code=http_status.HTTP_200_OK,
    summary="List active companies for audit selection (Super Admin only)",
)
def get_audit_companies_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_audit_companies_controller(db=db, actor=current_user)
    except PermissionError as err:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/company-users",
    response_model=AuditCompanyUserListResponse,
    status_code=http_status.HTTP_200_OK,
    summary="List users belonging to a company for audit selection (Client Admin sees own; Super Admin passes company_id)",
)
def get_company_users_route(
    company_id: int | None = Query(default=None, description="Company/Client ID (Required for Super Admin)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_company_users_controller(
            db=db,
            actor=current_user,
            company_id=company_id,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/me/company-users",
    response_model=AuditCompanyUserListResponse,
    status_code=http_status.HTTP_200_OK,
    summary="List users belonging to the authenticated Client's company",
)
def get_my_company_users_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_company_users_controller(
            db=db,
            actor=current_user,
            company_id=None,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/user/{user_id}",
    response_model=AuditLogListResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Get paginated activity logs for a selected user with company authorization",
)
def get_user_activity_logs_route(
    user_id: int,
    company_id: int | None = Query(default=None, description="Company ID for verification"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    module: str | None = Query(default=None, description="Filter by module"),
    action: str | None = Query(default=None, description="Filter by action name"),
    status: str | None = Query(default=None, description="Filter by status (SUCCESS, FAILED)"),
    start_date: str | None = Query(default=None, description="Start date filter (ISO format)"),
    end_date: str | None = Query(default=None, description="End date filter (ISO format)"),
    search: str | None = Query(default=None, description="Search term across description, action, entity"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_target_user_activity_logs_controller(
            db=db,
            actor=current_user,
            target_user_id=user_id,
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
    except PermissionError as err:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/user/{user_id}/summary",
    response_model=UserActivitySummaryResponse,
    status_code=http_status.HTTP_200_OK,
    summary="Get activity statistics and charts for a selected user with company authorization",
)
def get_user_activity_summary_route(
    user_id: int,
    company_id: int | None = Query(default=None, description="Company ID for verification"),
    module: str | None = Query(default=None, description="Filter by module"),
    action: str | None = Query(default=None, description="Filter by action"),
    status: str | None = Query(default=None, description="Filter by status"),
    start_date: str | None = Query(default=None, description="Start date filter (ISO format)"),
    end_date: str | None = Query(default=None, description="End date filter (ISO format)"),
    search: str | None = Query(default=None, description="Search term"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_target_user_activity_summary_controller(
            db=db,
            actor=current_user,
            target_user_id=user_id,
            company_id=company_id,
            module=module,
            action=action,
            status=status,
            start_date=start_date,
            end_date=end_date,
            search=search,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


# Bind user activity endpoints to activity_router alias
activity_router.add_api_route("/me", get_my_activity_logs_route, methods=["GET"], response_model=AuditLogListResponse)
activity_router.add_api_route("/me/summary", get_my_activity_summary_route, methods=["GET"], response_model=UserActivitySummaryResponse)
activity_router.add_api_route("/activity", record_activity_route, methods=["POST"], response_model=AuditLogResponse, status_code=http_status.HTTP_201_CREATED)
activity_router.add_api_route("/companies", get_audit_companies_route, methods=["GET"], response_model=AuditCompanyListResponse)
activity_router.add_api_route("/company-users", get_company_users_route, methods=["GET"], response_model=AuditCompanyUserListResponse)
activity_router.add_api_route("/me/company-users", get_my_company_users_route, methods=["GET"], response_model=AuditCompanyUserListResponse)
activity_router.add_api_route("/user/{user_id}", get_user_activity_logs_route, methods=["GET"], response_model=AuditLogListResponse)
activity_router.add_api_route("/user/{user_id}/summary", get_user_activity_summary_route, methods=["GET"], response_model=UserActivitySummaryResponse)

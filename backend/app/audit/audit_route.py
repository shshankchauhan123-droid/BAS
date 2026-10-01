from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.audit.audit_controller import (
    get_audit_stats_controller,
    list_audit_logs_controller,
)
from app.audit.audit_schema import (
    AuditLogListResponse,
    AuditStatsResponse,
)
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.user.user_model import User

router = APIRouter(
    prefix="/api/v1/audit-logs",
    tags=["Audit Logs & Activity Trail"],
)


@router.get(
    "/",
    response_model=AuditLogListResponse,
    status_code=status.HTTP_200_OK,
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/stats",
    response_model=AuditStatsResponse,
    status_code=status.HTTP_200_OK,
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

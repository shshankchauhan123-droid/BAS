from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.roles import ADMIN_ROLE, SUPERADMIN_ROLE
from app.dependencies.auth import get_current_user, require_roles
from app.support.support_controller import (
    add_admin_ticket_reply_controller,
    add_my_ticket_reply_controller,
    create_ticket_controller,
    get_admin_ticket_details_controller,
    get_all_tickets_summary_admin_controller,
    get_my_ticket_details_controller,
    get_my_tickets_summary_controller,
    list_all_tickets_admin_controller,
    list_my_tickets_controller,
    update_ticket_admin_controller,
)
from app.support.support_schema import (
    AdminTicketSummaryResponse,
    AdminTicketUpdateRequest,
    SupportTicketListResponse,
    SupportTicketResponse,
    TicketActivityResponse,
    TicketCreateRequest,
    TicketReplyRequest,
    UserTicketSummaryResponse,
)
from app.support.support_service import (
    get_admin_ticket_attachment,
    get_user_ticket_attachment,
)
from app.user.user_model import User


# ============================================================
# USER ROUTER
# ============================================================

user_support_router = APIRouter(
    prefix="/api/v1/support",
    tags=["Help & Support"],
)


@user_support_router.post(
    "/tickets",
    response_model=SupportTicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new support ticket (accepts JSON or multipart/form-data with optional attachment)",
)
async def create_ticket_route(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        content_type = request.headers.get("content-type", "")
        attachment_file = None

        if "multipart/form-data" in content_type:
            form = await request.form()
            subject = form.get("subject")
            category = form.get("category")
            description = form.get("description")
            priority = form.get("priority") or "medium"
            related_module = form.get("related_module")
            attachment_file = form.get("attachment") or form.get("file")

            data = TicketCreateRequest(
                subject=str(subject or "").strip(),
                category=str(category or "").strip(),
                description=str(description or "").strip(),
                priority=str(priority or "medium").strip().lower(),
                related_module=str(related_module).strip() if related_module else None,
            )
        else:
            json_body = await request.json()
            data = TicketCreateRequest(**json_body)

        return create_ticket_controller(
            db=db,
            user=current_user,
            data=data,
            attachment_file=attachment_file,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except (ValueError, ValidationError) as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@user_support_router.get(
    "/tickets/my",
    response_model=SupportTicketListResponse,
    status_code=status.HTTP_200_OK,
    summary="List logged-in user's submitted support tickets",
)
def list_my_tickets_route(
    search: str | None = Query(default=None, description="Search by ticket ID or subject"),
    status_filter: str | None = Query(default=None, alias="status", description="Filter by ticket status"),
    priority: str | None = Query(default=None, description="Filter by ticket priority"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=100, description="Page size"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return list_my_tickets_controller(
            db=db,
            user=current_user,
            search=search,
            status=status_filter,
            priority=priority,
            page=page,
            page_size=page_size,
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@user_support_router.get(
    "/tickets/my/summary",
    response_model=UserTicketSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Summary status counts for current user's tickets",
)
def get_my_tickets_summary_route(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return get_my_tickets_summary_controller(
            db=db,
            user=current_user,
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@user_support_router.get(
    "/tickets/my/{ticket_id}",
    response_model=SupportTicketResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user's own ticket details with activity timeline",
)
def get_my_ticket_details_route(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return get_my_ticket_details_controller(
            db=db,
            user=current_user,
            ticket_id=ticket_id,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@user_support_router.post(
    "/tickets/my/{ticket_id}/replies",
    response_model=TicketActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a user reply to own open/in-progress/resolved ticket",
)
def add_my_ticket_reply_route(
    ticket_id: int,
    data: TicketReplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return add_my_ticket_reply_controller(
            db=db,
            user=current_user,
            ticket_id=ticket_id,
            data=data,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
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
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@user_support_router.get(
    "/tickets/my/{ticket_id}/attachment",
    summary="Download user's own ticket attachment",
)
def download_my_ticket_attachment_route(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        file_path, filename, mime_type = get_user_ticket_attachment(
            db=db,
            user=current_user,
            ticket_id=ticket_id,
        )
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=mime_type,
        )
    except PermissionError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
    except (ValueError, FileNotFoundError) as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@user_support_router.delete(
    "/tickets/{ticket_id}",
    summary="Delete ticket (Forbidden for clients and regular users)",
)
def delete_ticket_route(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Clients and regular users cannot delete support tickets.",
    )


@user_support_router.patch(
    "/tickets/{ticket_id}",
    summary="Update ticket (Forbidden for clients and regular users)",
)
@user_support_router.patch(
    "/tickets/{ticket_id}/status",
    summary="Change ticket status (Forbidden for clients and regular users)",
)
@user_support_router.patch(
    "/tickets/{ticket_id}/priority",
    summary="Change ticket priority (Forbidden for clients and regular users)",
)
@user_support_router.post(
    "/tickets/{ticket_id}/assign",
    summary="Assign ticket (Forbidden for clients and regular users)",
)
def forbidden_ticket_management_route(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Clients and regular users have read-only access and cannot update, assign, or change ticket status.",
    )


# ============================================================
# SUPER ADMIN ROUTER
# ============================================================

admin_support_router = APIRouter(
    prefix="/api/v1/admin/support",
    tags=["Super Admin Support Management"],
)


@admin_support_router.get(
    "/tickets",
    response_model=SupportTicketListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all tickets across all tenants with filtering and pagination",
)
def list_all_tickets_admin_route(
    search: str | None = Query(default=None, description="Search across ticket ID, subject, client, user"),
    client_id: int | None = Query(default=None, description="Filter by client company ID"),
    status_filter: str | None = Query(default=None, alias="status", description="Filter by ticket status"),
    priority: str | None = Query(default=None, description="Filter by ticket priority"),
    category: str | None = Query(default=None, description="Filter by category"),
    start_date: str | None = Query(default=None, description="Start date ISO"),
    end_date: str | None = Query(default=None, description="End date ISO"),
    sort_by: str = Query(default="created_at", description="Field to sort by"),
    sort_order: str = Query(default="desc", description="Sort order: asc or desc"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=100, description="Page size"),
    current_user: User = Depends(require_roles([SUPERADMIN_ROLE, ADMIN_ROLE])),
    db: Session = Depends(get_db),
):
    try:
        return list_all_tickets_admin_controller(
            db=db,
            search=search,
            client_id=client_id,
            status=status_filter,
            priority=priority,
            category=category,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size,
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@admin_support_router.get(
    "/tickets/summary",
    response_model=AdminTicketSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Global summary statistics of all support tickets",
)
def get_all_tickets_summary_admin_route(
    current_user: User = Depends(require_roles([SUPERADMIN_ROLE, ADMIN_ROLE])),
    db: Session = Depends(get_db),
):
    try:
        return get_all_tickets_summary_admin_controller(db=db)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@admin_support_router.get(
    "/tickets/{ticket_id}",
    response_model=SupportTicketResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complete ticket details for Super Admin, including internal notes",
)
def get_admin_ticket_details_route(
    ticket_id: int,
    current_user: User = Depends(require_roles([SUPERADMIN_ROLE, ADMIN_ROLE])),
    db: Session = Depends(get_db),
):
    try:
        return get_admin_ticket_details_controller(
            db=db,
            ticket_id=ticket_id,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@admin_support_router.patch(
    "/tickets/{ticket_id}",
    response_model=SupportTicketResponse,
    status_code=status.HTTP_200_OK,
    summary="Update ticket status, assignment, or resolution notes",
)
def update_ticket_admin_route(
    ticket_id: int,
    data: AdminTicketUpdateRequest,
    current_user: User = Depends(require_roles([SUPERADMIN_ROLE, ADMIN_ROLE])),
    db: Session = Depends(get_db),
):
    try:
        return update_ticket_admin_controller(
            db=db,
            admin=current_user,
            ticket_id=ticket_id,
            data=data,
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
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@admin_support_router.post(
    "/tickets/{ticket_id}/replies",
    response_model=TicketActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add public reply or internal admin note to a ticket",
)
def add_admin_ticket_reply_route(
    ticket_id: int,
    data: TicketReplyRequest,
    current_user: User = Depends(require_roles([SUPERADMIN_ROLE, ADMIN_ROLE])),
    db: Session = Depends(get_db),
):
    try:
        return add_admin_ticket_reply_controller(
            db=db,
            admin=current_user,
            ticket_id=ticket_id,
            data=data,
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
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )


@admin_support_router.get(
    "/tickets/{ticket_id}/attachment",
    summary="Download ticket attachment for Super Admin",
)
def download_admin_ticket_attachment_route(
    ticket_id: int,
    current_user: User = Depends(require_roles([SUPERADMIN_ROLE, ADMIN_ROLE])),
    db: Session = Depends(get_db),
):
    try:
        file_path, filename, mime_type = get_admin_ticket_attachment(
            db=db,
            ticket_id=ticket_id,
        )
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=mime_type,
        )
    except (ValueError, FileNotFoundError) as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        )

from datetime import datetime
from sqlalchemy.orm import Session

from app.support.support_model import SupportTicket, TicketActivity
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
    add_admin_ticket_reply,
    add_user_ticket_reply,
    create_user_ticket,
    get_admin_ticket_details,
    get_all_tickets_summary_admin,
    get_my_ticket_details,
    get_my_tickets_summary,
    list_all_tickets_admin,
    list_my_tickets,
    update_ticket_admin,
)
from app.user.user_model import User


def format_activity(activity: TicketActivity) -> TicketActivityResponse:
    return TicketActivityResponse(
        id=activity.id,
        ticket_id=activity.ticket_id,
        author_id=activity.author_id,
        author_role=activity.author_role,
        author_name=activity.author_name or (activity.author.username if activity.author else "System"),
        activity_type=activity.activity_type,
        message=activity.message,
        is_internal=activity.is_internal,
        created_at=activity.created_at,
    )


def format_ticket(
    ticket: SupportTicket,
    activities: list[TicketActivity] | None = None,
) -> SupportTicketResponse:
    client_name = ticket.client.name if ticket.client else None
    user_name = ticket.user.username if ticket.user else None
    user_email = ticket.user.email if ticket.user else None
    assigned_admin_name = ticket.assigned_admin.username if ticket.assigned_admin else None

    acts = [format_activity(a) for a in (activities or [])]

    return SupportTicketResponse(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        client_id=ticket.client_id,
        client_name=client_name,
        user_id=ticket.user_id,
        user_name=user_name,
        user_email=user_email,
        subject=ticket.subject,
        category=ticket.category,
        description=ticket.description,
        priority=ticket.priority,
        related_module=ticket.related_module,
        status=ticket.status,
        assigned_admin_id=ticket.assigned_admin_id,
        assigned_admin_name=assigned_admin_name,
        admin_response=ticket.admin_response,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        resolved_at=ticket.resolved_at,
        closed_at=ticket.closed_at,
        attachment_filename=ticket.attachment_filename,
        attachment_mime=ticket.attachment_mime,
        attachment_size=ticket.attachment_size,
        has_attachment=bool(ticket.attachment_path and ticket.attachment_filename),
        activities=acts,
    )


# ============================================================
# USER CONTROLLER METHODS
# ============================================================

def create_ticket_controller(
    db: Session,
    user: User,
    data: TicketCreateRequest,
    attachment_file=None,
) -> SupportTicketResponse:
    ticket = create_user_ticket(db=db, user=user, data=data, attachment_file=attachment_file)
    return format_ticket(ticket)


def list_my_tickets_controller(
    db: Session,
    user: User,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> SupportTicketListResponse:
    items, total, total_pages = list_my_tickets(
        db=db,
        user=user,
        search=search,
        status=status,
        priority=priority,
        page=page,
        page_size=page_size,
    )
    return SupportTicketListResponse(
        success=True,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=[format_ticket(item) for item in items],
    )


def get_my_tickets_summary_controller(
    db: Session,
    user: User,
) -> UserTicketSummaryResponse:
    counts = get_my_tickets_summary(db=db, user=user)
    return UserTicketSummaryResponse(**counts)


def get_my_ticket_details_controller(
    db: Session,
    user: User,
    ticket_id: int,
) -> SupportTicketResponse:
    ticket, activities = get_my_ticket_details(db=db, user=user, ticket_id=ticket_id)
    return format_ticket(ticket, activities)


def add_my_ticket_reply_controller(
    db: Session,
    user: User,
    ticket_id: int,
    data: TicketReplyRequest,
) -> TicketActivityResponse:
    activity = add_user_ticket_reply(
        db=db,
        user=user,
        ticket_id=ticket_id,
        message=data.message,
    )
    return format_activity(activity)


# ============================================================
# SUPER ADMIN CONTROLLER METHODS
# ============================================================

def list_all_tickets_admin_controller(
    db: Session,
    search: str | None = None,
    client_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 10,
) -> SupportTicketListResponse:
    parsed_start = None
    parsed_end = None
    if start_date and start_date.strip():
        try:
            parsed_start = datetime.fromisoformat(start_date.strip())
        except ValueError:
            pass
    if end_date and end_date.strip():
        try:
            parsed_end = datetime.fromisoformat(end_date.strip())
        except ValueError:
            pass

    items, total, total_pages = list_all_tickets_admin(
        db=db,
        search=search,
        client_id=client_id,
        status=status,
        priority=priority,
        category=category,
        start_date=parsed_start,
        end_date=parsed_end,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return SupportTicketListResponse(
        success=True,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=[format_ticket(item) for item in items],
    )


def get_all_tickets_summary_admin_controller(
    db: Session,
) -> AdminTicketSummaryResponse:
    counts = get_all_tickets_summary_admin(db)
    return AdminTicketSummaryResponse(**counts)


def get_admin_ticket_details_controller(
    db: Session,
    ticket_id: int,
) -> SupportTicketResponse:
    ticket, activities = get_admin_ticket_details(db=db, ticket_id=ticket_id)
    return format_ticket(ticket, activities)


def update_ticket_admin_controller(
    db: Session,
    admin: User,
    ticket_id: int,
    data: AdminTicketUpdateRequest,
) -> SupportTicketResponse:
    ticket = update_ticket_admin(
        db=db,
        admin=admin,
        ticket_id=ticket_id,
        data=data,
    )
    activities = get_admin_ticket_details(db, ticket_id)[1]
    return format_ticket(ticket, activities)


def add_admin_ticket_reply_controller(
    db: Session,
    admin: User,
    ticket_id: int,
    data: TicketReplyRequest,
) -> TicketActivityResponse:
    activity = add_admin_ticket_reply(
        db=db,
        admin=admin,
        ticket_id=ticket_id,
        message=data.message,
        is_internal=data.is_internal,
    )
    return format_activity(activity)

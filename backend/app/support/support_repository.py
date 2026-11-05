import math
from datetime import datetime, timezone
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.client.client_model import Client
from app.support.support_model import SupportTicket, TicketActivity
from app.user.user_model import User


def get_next_ticket_number(db: Session) -> str:
    """
    Generate sequential human-readable ticket number: BAS-TKT-YYYY-000001
    """
    current_year = datetime.now(timezone.utc).year
    prefix = f"BAS-TKT-{current_year}-"

    latest_ticket = (
        db.query(SupportTicket.ticket_number)
        .filter(SupportTicket.ticket_number.like(f"{prefix}%"))
        .order_by(SupportTicket.id.desc())
        .first()
    )

    if latest_ticket and latest_ticket[0]:
        try:
            seq_part = latest_ticket[0].split("-")[-1]
            next_num = int(seq_part) + 1
        except Exception:
            next_num = 1
    else:
        next_num = 1

    return f"{prefix}{next_num:06d}"


def create_support_ticket(db: Session, ticket: SupportTicket) -> SupportTicket:
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def get_ticket_by_id(db: Session, ticket_id: int) -> SupportTicket | None:
    return (
        db.query(SupportTicket)
        .options(
            joinedload(SupportTicket.client),
            joinedload(SupportTicket.user),
            joinedload(SupportTicket.assigned_admin),
        )
        .filter(SupportTicket.id == ticket_id)
        .first()
    )


def get_ticket_by_number(db: Session, ticket_number: str) -> SupportTicket | None:
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.ticket_number == ticket_number.strip())
        .first()
    )


def list_user_tickets(
    db: Session,
    user_id: int,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    page: int = 1,
    page_size: int = 10,
    client_id: int | None = None,
) -> tuple[list[SupportTicket], int, int]:
    query = (
        db.query(SupportTicket)
        .options(
            joinedload(SupportTicket.client),
            joinedload(SupportTicket.user),
            joinedload(SupportTicket.assigned_admin),
        )
        .outerjoin(User, SupportTicket.user_id == User.id)
    )

    if client_id is not None:
        query = query.filter(
            or_(
                SupportTicket.client_id == client_id,
                User.client_id == client_id,
            )
        )
    else:
        query = query.filter(SupportTicket.user_id == user_id)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(SupportTicket.ticket_number).like(term),
                func.lower(SupportTicket.subject).like(term),
                func.lower(SupportTicket.description).like(term),
                func.lower(User.username).like(term),
                func.lower(User.email).like(term),
            )
        )

    if status and status.strip():
        st = status.strip().lower()
        if st in {"resolved_closed", "resolved/closed"}:
            query = query.filter(SupportTicket.status.in_(["resolved", "closed"]))
        else:
            query = query.filter(func.lower(SupportTicket.status) == st)

    if priority and priority.strip():
        query = query.filter(func.lower(SupportTicket.priority) == priority.strip().lower())

    total_count = query.count()
    total_pages = max(1, math.ceil(total_count / page_size)) if total_count > 0 else 1

    items = (
        query.order_by(SupportTicket.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return items, total_count, total_pages


def get_user_tickets_summary(
    db: Session,
    user_id: int,
    client_id: int | None = None,
) -> dict:
    if client_id is not None:
        base_query = (
            db.query(SupportTicket)
            .outerjoin(User, SupportTicket.user_id == User.id)
            .filter(
                or_(
                    SupportTicket.client_id == client_id,
                    User.client_id == client_id,
                )
            )
        )
    else:
        base_query = db.query(SupportTicket).filter(SupportTicket.user_id == user_id)
    total = base_query.count()
    open_count = base_query.filter(func.lower(SupportTicket.status) == "open").count()
    in_progress = base_query.filter(func.lower(SupportTicket.status).in_(["in_progress", "waiting_user"])).count()
    resolved = base_query.filter(func.lower(SupportTicket.status) == "resolved").count()
    closed = base_query.filter(func.lower(SupportTicket.status) == "closed").count()

    return {
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "resolved": resolved,
        "closed": closed,
    }


def list_admin_tickets(
    db: Session,
    search: str | None = None,
    client_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[SupportTicket], int, int]:
    query = (
        db.query(SupportTicket)
        .options(
            joinedload(SupportTicket.client),
            joinedload(SupportTicket.user),
            joinedload(SupportTicket.assigned_admin),
        )
        .outerjoin(Client, SupportTicket.client_id == Client.id)
        .outerjoin(User, SupportTicket.user_id == User.id)
    )

    if client_id is not None:
        query = query.filter(SupportTicket.client_id == client_id)

    if status and status.strip():
        query = query.filter(func.lower(SupportTicket.status) == status.strip().lower())

    if priority and priority.strip():
        query = query.filter(func.lower(SupportTicket.priority) == priority.strip().lower())

    if category and category.strip():
        query = query.filter(func.lower(SupportTicket.category) == category.strip().lower())

    if start_date is not None:
        query = query.filter(SupportTicket.created_at >= start_date)

    if end_date is not None:
        query = query.filter(SupportTicket.created_at <= end_date)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(SupportTicket.ticket_number).like(term),
                func.lower(SupportTicket.subject).like(term),
                func.lower(SupportTicket.description).like(term),
                func.lower(Client.name).like(term),
                func.lower(User.username).like(term),
                func.lower(User.email).like(term),
            )
        )

    # Sorting
    sort_col = getattr(SupportTicket, sort_by, SupportTicket.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total_count = query.count()
    total_pages = max(1, math.ceil(total_count / page_size)) if total_count > 0 else 1

    items = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return items, total_count, total_pages


def get_admin_tickets_summary(db: Session) -> dict:
    base_query = db.query(SupportTicket)
    total = base_query.count()
    open_count = base_query.filter(func.lower(SupportTicket.status) == "open").count()
    in_progress = base_query.filter(func.lower(SupportTicket.status) == "in_progress").count()
    waiting_user = base_query.filter(func.lower(SupportTicket.status) == "waiting_user").count()
    resolved = base_query.filter(func.lower(SupportTicket.status) == "resolved").count()
    closed = base_query.filter(func.lower(SupportTicket.status) == "closed").count()

    return {
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "waiting_user": waiting_user,
        "resolved": resolved,
        "closed": closed,
    }


def add_ticket_activity(db: Session, activity: TicketActivity) -> TicketActivity:
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def get_ticket_activities(
    db: Session,
    ticket_id: int,
    include_internal: bool = False,
) -> list[TicketActivity]:
    query = (
        db.query(TicketActivity)
        .options(joinedload(TicketActivity.author))
        .filter(TicketActivity.ticket_id == ticket_id)
    )
    if not include_internal:
        query = query.filter(TicketActivity.is_internal.is_(False))

    return query.order_by(TicketActivity.created_at.asc()).all()


def update_ticket(db: Session, ticket: SupportTicket) -> SupportTicket:
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ticket)
    return ticket

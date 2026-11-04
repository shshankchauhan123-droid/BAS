from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import uuid
from sqlalchemy.orm import Session

from app.audit.audit_service import record_audit_log
from app.support.support_model import SupportTicket, TicketActivity
from app.support.support_repository import (
    add_ticket_activity,
    create_support_ticket,
    get_admin_tickets_summary,
    get_next_ticket_number,
    get_ticket_activities,
    get_ticket_by_id,
    get_user_tickets_summary,
    list_admin_tickets,
    list_user_tickets,
    update_ticket,
)
from app.support.support_schema import (
    AdminTicketUpdateRequest,
    TicketCreateRequest,
)
from app.user.user_model import User

logger = logging.getLogger(__name__)

MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_ATTACHMENT_EXTENSIONS = {
    # Excel
    ".xlsx",
    ".xls",
    ".csv",
    # Documents
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    # Images
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
}


def normalize_status(status: str | None) -> str:
    return str(status or "").strip().lower().replace(" ", "_").replace("-", "_")


def validate_and_save_ticket_attachment(upload_file) -> tuple[str, str, str, int]:
    """
    Validates uploaded file against 10MB limit and safe extensions.
    Saves to storage/support_attachments/ with unique UUID name.
    Returns (original_filename, stored_path_str, mime_type, file_size).
    """
    if not upload_file or not getattr(upload_file, "filename", None):
        raise ValueError("Attachment file or filename is missing.")

    original_filename = os.path.basename(upload_file.filename.strip())
    ext = Path(original_filename).suffix.lower()

    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext or 'unknown'}'. "
            "Allowed formats: Excel (.xlsx, .xls, .csv), Documents (.pdf, .doc, .docx, .txt), and Images (.png, .jpg, .jpeg, .gif, .webp)."
        )

    DANGEROUS_EXTENSIONS = {
        ".exe", ".bat", ".cmd", ".sh", ".php", ".py", ".js", ".vbs",
        ".msi", ".dll", ".com", ".scr", ".jar", ".html", ".htm",
    }
    if ext in DANGEROUS_EXTENSIONS:
        raise ValueError(f"Executable and script files ({ext}) are strictly prohibited.")

    target_dir = Path("storage") / "support_attachments"
    target_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}{ext}"
    target_path = target_dir / stored_name

    file_size = 0
    try:
        if hasattr(upload_file.file, "seek"):
            upload_file.file.seek(0)

        with open(target_path, "wb") as out_f:
            while True:
                chunk = upload_file.file.read(1024 * 1024)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > MAX_ATTACHMENT_SIZE:
                    out_f.close()
                    if target_path.exists():
                        target_path.unlink()
                    raise ValueError("File size must be 10 MB or less.")
                out_f.write(chunk)
    except Exception as err:
        if target_path.exists():
            target_path.unlink()
        raise err

    mime_type = getattr(upload_file, "content_type", None) or "application/octet-stream"
    return original_filename, str(target_path.as_posix()), mime_type, file_size


# ============================================================
# USER TICKET OPERATIONS
# ============================================================

def create_user_ticket(
    db: Session,
    user: User,
    data: TicketCreateRequest,
    attachment_file=None,
) -> SupportTicket:
    ticket_number = get_next_ticket_number(db)

    orig_name = None
    stored_path = None
    mime_type = None
    file_size = None

    if attachment_file and getattr(attachment_file, "filename", None):
        orig_name, stored_path, mime_type, file_size = validate_and_save_ticket_attachment(attachment_file)

    ticket = SupportTicket(
        ticket_number=ticket_number,
        client_id=user.client_id,
        user_id=user.id,
        subject=data.subject.strip(),
        category=data.category.strip(),
        description=data.description.strip(),
        priority=data.priority.lower(),
        related_module=data.related_module.strip() if data.related_module else None,
        status="open",
        attachment_filename=orig_name,
        attachment_path=stored_path,
        attachment_mime=mime_type,
        attachment_size=file_size,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    created_ticket = create_support_ticket(db, ticket)

    # Initial creation activity
    init_msg = f"Ticket created by user with attachment: {orig_name}." if orig_name else "Ticket created by user."
    initial_activity = TicketActivity(
        ticket_id=created_ticket.id,
        author_id=user.id,
        author_role=str(user.role).lower(),
        author_name=user.username,
        activity_type="created",
        message=init_msg,
        is_internal=False,
        created_at=datetime.now(timezone.utc),
    )
    add_ticket_activity(db, initial_activity)

    # Record in audit log
    try:
        record_audit_log(
            db=db,
            action="TICKET_CREATED",
            entity_type="support_ticket",
            entity_id=str(created_ticket.id),
            entity_name=created_ticket.ticket_number,
            description=f"Ticket '{created_ticket.ticket_number}' created with subject: {created_ticket.subject}",
            actor=user,
            details={
                "ticket_number": created_ticket.ticket_number,
                "category": created_ticket.category,
                "priority": created_ticket.priority,
            },
        )
    except Exception as exc:
        logger.warning("Failed to record ticket creation audit log: %s", exc)

    return created_ticket


def list_my_tickets(
    db: Session,
    user: User,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[SupportTicket], int, int]:
    return list_user_tickets(
        db=db,
        user_id=user.id,
        search=search,
        status=status,
        priority=priority,
        page=page,
        page_size=page_size,
    )


def get_my_tickets_summary(db: Session, user: User) -> dict:
    return get_user_tickets_summary(db=db, user_id=user.id)


def get_my_ticket_details(
    db: Session,
    user: User,
    ticket_id: int,
) -> tuple[SupportTicket, list[TicketActivity]]:
    ticket = get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise ValueError(f"Ticket with ID {ticket_id} not found.")

    # Strict IDOR protection
    if ticket.user_id != user.id:
        raise PermissionError("Access denied. You cannot view tickets belonging to another user.")

    # Exclude internal admin notes for users
    activities = get_ticket_activities(db, ticket_id, include_internal=False)
    return ticket, activities


def add_user_ticket_reply(
    db: Session,
    user: User,
    ticket_id: int,
    message: str,
) -> TicketActivity:
    ticket = get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise ValueError(f"Ticket with ID {ticket_id} not found.")

    if ticket.user_id != user.id:
        raise PermissionError("Access denied. You cannot reply to another user's ticket.")

    if normalize_status(ticket.status) == "closed":
        raise ValueError("This ticket is closed. Replies are disabled.")

    cleaned_msg = message.strip()
    if not cleaned_msg:
        raise ValueError("Reply message cannot be empty.")

    activity = TicketActivity(
        ticket_id=ticket.id,
        author_id=user.id,
        author_role=str(user.role).lower(),
        author_name=user.username,
        activity_type="reply",
        message=cleaned_msg,
        is_internal=False,
        created_at=datetime.now(timezone.utc),
    )
    added_activity = add_ticket_activity(db, activity)

    # If ticket was waiting for user, transition back to in_progress
    if ticket.status == "waiting_user":
        ticket.status = "in_progress"

    update_ticket(db, ticket)
    return added_activity


# ============================================================
# SUPER ADMIN TICKET OPERATIONS
# ============================================================

def list_all_tickets_admin(
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
    return list_admin_tickets(
        db=db,
        search=search,
        client_id=client_id,
        status=status,
        priority=priority,
        category=category,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


def get_all_tickets_summary_admin(db: Session) -> dict:
    return get_admin_tickets_summary(db)


def get_admin_ticket_details(
    db: Session,
    ticket_id: int,
) -> tuple[SupportTicket, list[TicketActivity]]:
    ticket = get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise ValueError(f"Ticket with ID {ticket_id} not found.")

    # Admins see full timeline including internal notes
    activities = get_ticket_activities(db, ticket_id, include_internal=True)
    return ticket, activities


def update_ticket_admin(
    db: Session,
    admin: User,
    ticket_id: int,
    data: AdminTicketUpdateRequest,
) -> SupportTicket:
    ticket = get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise ValueError(f"Ticket with ID {ticket_id} not found.")

    now = datetime.now(timezone.utc)
    activity_notes = []

    # 1. Status Update
    if data.status and data.status != ticket.status:
        old_status = ticket.status
        ticket.status = data.status

        if data.status == "resolved":
            ticket.resolved_at = now
        elif data.status == "closed":
            ticket.closed_at = now
        elif old_status in {"resolved", "closed"} and data.status in {"open", "in_progress"}:
            ticket.resolved_at = None
            ticket.closed_at = None

        activity_notes.append(
            TicketActivity(
                ticket_id=ticket.id,
                author_id=admin.id,
                author_role=str(admin.role).lower(),
                author_name=admin.username,
                activity_type="status_change",
                message=f"Status changed from '{old_status}' to '{data.status}'.",
                is_internal=False,
                created_at=now,
            )
        )

    # 2. Priority Protection: Ticket priority cannot be modified after creation
    if data.priority is not None and data.priority != ticket.priority:
        raise ValueError("Ticket priority cannot be modified after creation.")

    # 3. Assigned Admin Update
    if data.assigned_admin_id is not None and data.assigned_admin_id != ticket.assigned_admin_id:
        assigned_user = db.query(User).filter(User.id == data.assigned_admin_id).first()
        assigned_name = assigned_user.username if assigned_user else f"Admin #{data.assigned_admin_id}"
        ticket.assigned_admin_id = data.assigned_admin_id
        activity_notes.append(
            TicketActivity(
                ticket_id=ticket.id,
                author_id=admin.id,
                author_role=str(admin.role).lower(),
                author_name=admin.username,
                activity_type="assignment_change",
                message=f"Ticket assigned to {assigned_name}.",
                is_internal=False,
                created_at=now,
            )
        )

    # 4. Admin Response / Resolution Summary
    if data.admin_response is not None:
        cleaned_response = data.admin_response.strip()
        ticket.admin_response = cleaned_response
        if cleaned_response:
            activity_notes.append(
                TicketActivity(
                    ticket_id=ticket.id,
                    author_id=admin.id,
                    author_role=str(admin.role).lower(),
                    author_name=admin.username,
                    activity_type="resolution_note",
                    message=f"Admin Resolution Note: {cleaned_response}",
                    is_internal=False,
                    created_at=now,
                )
            )

    updated_ticket = update_ticket(db, ticket)

    for act in activity_notes:
        add_ticket_activity(db, act)

    # Audit log
    try:
        record_audit_log(
            db=db,
            action="TICKET_UPDATED",
            entity_type="support_ticket",
            entity_id=str(ticket.id),
            entity_name=ticket.ticket_number,
            description=f"Ticket '{ticket.ticket_number}' updated by {admin.username}",
            actor=admin,
            details={"status": ticket.status, "priority": ticket.priority},
        )
    except Exception as exc:
        logger.warning("Failed to record ticket update audit log: %s", exc)

    return updated_ticket


def add_admin_ticket_reply(
    db: Session,
    admin: User,
    ticket_id: int,
    message: str,
    is_internal: bool = False,
) -> TicketActivity:
    ticket = get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise ValueError(f"Ticket with ID {ticket_id} not found.")

    if normalize_status(ticket.status) == "closed":
        raise ValueError("This ticket is closed. Replies are disabled.")

    cleaned_msg = message.strip()
    if not cleaned_msg:
        raise ValueError("Reply message cannot be empty.")

    now = datetime.now(timezone.utc)
    activity = TicketActivity(
        ticket_id=ticket.id,
        author_id=admin.id,
        author_role=str(admin.role).lower(),
        author_name=admin.username,
        activity_type="internal_note" if is_internal else "admin_reply",
        message=cleaned_msg,
        is_internal=is_internal,
        created_at=now,
    )
    added_activity = add_ticket_activity(db, activity)

    # If public reply and ticket was open or waiting, update status
    if not is_internal:
        ticket.admin_response = cleaned_msg
        if ticket.status == "open":
            ticket.status = "in_progress"

    update_ticket(db, ticket)
    return added_activity


# ============================================================
# TICKET ATTACHMENT OPERATIONS
# ============================================================

def get_user_ticket_attachment(
    db: Session,
    user: User,
    ticket_id: int,
) -> tuple[str, str, str]:
    ticket = get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise ValueError(f"Ticket with ID {ticket_id} not found.")

    if ticket.user_id != user.id:
        raise PermissionError("Access denied. You cannot access attachments for tickets belonging to another user.")

    if not ticket.attachment_path or not ticket.attachment_filename:
        raise ValueError("This ticket does not have an attachment.")

    p = Path(ticket.attachment_path)
    if not p.exists() or not p.is_file():
        raise FileNotFoundError("Attachment file not found on server.")

    return ticket.attachment_path, ticket.attachment_filename, ticket.attachment_mime or "application/octet-stream"


def get_admin_ticket_attachment(
    db: Session,
    ticket_id: int,
) -> tuple[str, str, str]:
    ticket = get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise ValueError(f"Ticket with ID {ticket_id} not found.")

    if not ticket.attachment_path or not ticket.attachment_filename:
        raise ValueError("This ticket does not have an attachment.")

    p = Path(ticket.attachment_path)
    if not p.exists() or not p.is_file():
        raise FileNotFoundError("Attachment file not found on server.")

    return ticket.attachment_path, ticket.attachment_filename, ticket.attachment_mime or "application/octet-stream"


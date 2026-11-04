from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class TicketCreateRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=255)
    category: str = Field(min_length=2, max_length=50)
    description: str = Field(min_length=5)
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    related_module: str | None = Field(default=None, max_length=100)


class TicketReplyRequest(BaseModel):
    message: str = Field(min_length=1)
    is_internal: bool = False


class AdminTicketUpdateRequest(BaseModel):
    status: Literal["open", "in_progress", "waiting_user", "resolved", "closed"] | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None
    assigned_admin_id: int | None = None
    admin_response: str | None = None


# ============================================================
# RESPONSE SCHEMAS
# ============================================================

class TicketActivityResponse(BaseModel):
    id: int
    ticket_id: int
    author_id: int | None = None
    author_role: str
    author_name: str | None = None
    activity_type: str
    message: str
    is_internal: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class SupportTicketResponse(BaseModel):
    id: int
    ticket_number: str
    client_id: int | None = None
    client_name: str | None = None
    user_id: int
    user_name: str | None = None
    user_email: str | None = None
    subject: str
    category: str
    description: str
    priority: str
    related_module: str | None = None
    status: str
    assigned_admin_id: int | None = None
    assigned_admin_name: str | None = None
    admin_response: str | None = None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    attachment_filename: str | None = None
    attachment_mime: str | None = None
    attachment_size: int | None = None
    has_attachment: bool = False
    activities: list[TicketActivityResponse] = []

    class Config:
        from_attributes = True


class SupportTicketListResponse(BaseModel):
    success: bool = True
    total: int
    page: int
    page_size: int
    total_pages: int
    data: list[SupportTicketResponse]


class UserTicketSummaryResponse(BaseModel):
    total: int
    open: int
    in_progress: int
    resolved: int
    closed: int


class AdminTicketSummaryResponse(BaseModel):
    total: int
    open: int
    in_progress: int
    waiting_user: int
    resolved: int
    closed: int

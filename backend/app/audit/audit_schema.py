from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int | None = None
    user_id: int | None = None
    user_email: str
    user_name: str
    user_role: str
    action: str
    entity_type: str
    entity_id: str
    entity_name: str | None = None
    description: str
    details: Any | None = None
    ip_address: str | None = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    success: bool = True
    message: str = "Audit logs retrieved successfully"
    total: int
    page: int
    page_size: int
    total_pages: int
    data: list[AuditLogResponse]


class AuditStatsData(BaseModel):
    total_today: int = 0
    case_activities: int = 0
    file_uploads: int = 0
    file_processing_failures: int = 0
    user_management_activities: int = 0


class AuditStatsResponse(BaseModel):
    success: bool = True
    message: str = "Audit statistics retrieved successfully"
    data: AuditStatsData

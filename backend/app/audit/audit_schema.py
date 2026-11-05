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
    module: str | None = None
    status: str = "SUCCESS"
    entity_type: str
    entity_id: str
    entity_name: str | None = None
    description: str
    details: Any | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    success: bool = True
    message: str = "Audit logs retrieved successfully"
    total: int
    total_count: int | None = None
    page: int
    page_size: int
    total_pages: int
    data: list[AuditLogResponse]
    logs: list[AuditLogResponse] = []

    def model_post_init(self, __context: Any) -> None:
        if self.total_count is None:
            self.total_count = self.total
        if not self.logs and self.data:
            self.logs = self.data


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


class UserActivitySummaryStats(BaseModel):
    total_activities: int = 0
    successful_actions: int = 0
    failed_actions: int = 0
    reports_generated: int = 0
    cases_created_updated: int = 0
    cases_modified: int = 0
    login_sessions: int = 0

    def model_post_init(self, __context: Any) -> None:
        if self.cases_created_updated and not self.cases_modified:
            self.cases_modified = self.cases_created_updated
        elif self.cases_modified and not self.cases_created_updated:
            self.cases_created_updated = self.cases_modified


class ActivityTrendPoint(BaseModel):
    date: str
    count: int = 0
    success: int = 0
    failed: int = 0


class KeyValueCount(BaseModel):
    name: str
    count: int
    key: str | None = None

    def model_post_init(self, __context: Any) -> None:
        if not self.key and self.name:
            self.key = self.name


class UserActivitySummaryResponse(BaseModel):
    success: bool = True
    message: str = "Activity summary retrieved successfully"
    stats: UserActivitySummaryStats
    activity_trend: list[ActivityTrendPoint] = []
    daily_trend: list[ActivityTrendPoint] = []
    by_module: list[KeyValueCount] = []
    module_breakdown: list[KeyValueCount] = []
    by_action: list[KeyValueCount] = []
    action_breakdown: list[KeyValueCount] = []
    by_status: dict[str, int] = {}
    status_breakdown: dict[str, int] = {}
    available_modules: list[str] = []
    available_actions: list[str] = []


class LogActivityRequest(BaseModel):
    action: str
    module: str | None = None
    description: str
    entity_type: str = "general"
    entity_id: str | None = None
    entity_name: str | None = None
    status: str = "SUCCESS"
    details: dict[str, Any] | None = None

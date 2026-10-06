from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.io_master.io_master_schema import IOMasterData


class CaseCreateRequest(BaseModel):
    case_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=5000,
    )

    io_id: Optional[int] = Field(
        default=None,
        description="ID of the Investigating Officer assigned to this case",
    )

    assigned_to: Optional[int] = Field(
        default=None,
        description="ID of the user to whom this case is assigned",
    )


class CaseUpdateRequest(BaseModel):
    case_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=5000,
    )

    status: Optional[str] = None

    io_id: Optional[int] = None

    assigned_to: Optional[int] = None


class CaseCreatorData(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    role: str

class CaseData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_number: str
    case_name: str
    description: Optional[str]
    status: str
    created_by: Optional[int] = None
    assigned_to: Optional[int] = None
    io_id: Optional[int] = None
    io: Optional[IOMasterData] = None
    creator: Optional[CaseCreatorData] = None
    created_at: datetime
    updated_at: datetime


class CaseResponse(BaseModel):
    success: bool
    message: str
    data: CaseData


class CaseListResponse(BaseModel):
    success: bool
    message: str
    total: int
    data: list[CaseData]
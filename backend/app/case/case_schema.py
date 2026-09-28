from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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


class CaseData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_number: str
    case_name: str
    description: Optional[str]
    status: str
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
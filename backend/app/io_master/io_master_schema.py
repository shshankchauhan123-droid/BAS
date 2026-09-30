from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class IOMasterCreateRequest(BaseModel):
    officer_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Full name of the Investigating Officer",
    )

    designation: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Rank or designation of the officer (e.g., Inspector, Sub-Inspector)",
    )

    police_station: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Police Station or Unit branch name",
    )


class IOMasterUpdateRequest(BaseModel):
    officer_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    designation: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    police_station: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=200,
    )


class IOMasterData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    officer_name: str
    designation: str
    police_station: str
    created_by: int
    created_at: datetime
    updated_at: datetime


class IOMasterResponse(BaseModel):
    success: bool
    message: str
    data: IOMasterData


class IOMasterListResponse(BaseModel):
    success: bool
    message: str
    total: int
    data: list[IOMasterData]

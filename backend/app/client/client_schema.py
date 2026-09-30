from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class ClientAdminCreate(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50,
        description="Initial username for the Client Admin",
    )
    email: EmailStr = Field(
        description="Initial email for the Client Admin",
    )
    password: str = Field(
        min_length=6,
        max_length=128,
        description="Temporary initial password for the Client Admin",
    )


class ClientCreateRequest(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=100,
        description="Client company / organization name",
    )
    company_code: str = Field(
        min_length=2,
        max_length=50,
        description="Unique identifier / short code for the company",
    )
    max_users: int = Field(
        default=10,
        ge=1,
        le=1000,
        description="Maximum number of users allowed for this client",
    )
    admin: ClientAdminCreate = Field(
        description="Credentials for the initial Client Admin",
    )


class ClientUpdateStatusRequest(BaseModel):
    is_active: bool = Field(
        description="Instant enable (True) or disable (False) client company access",
    )


class ClientUpdateMaxUsersRequest(BaseModel):
    max_users: int = Field(
        ge=1,
        le=1000,
        description="Updated user quota / seat limit for the client",
    )


class ClientResponse(BaseModel):
    id: int
    name: str
    company_code: str
    max_users: int
    is_active: bool
    current_users_count: int = 0
    active_users: int = 0
    admin_email: str | None = None
    admin_username: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientListResponse(BaseModel):
    items: list[ClientResponse]
    clients: list[ClientResponse] = []
    total: int


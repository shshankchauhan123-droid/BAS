from pydantic import BaseModel, EmailStr, Field

from app.user.user_schema import UserPermissionsSchema


class SignupRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=100,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )


class SignupResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool
    client_id: int | None = None


class LoginRequest(BaseModel):
    username: str

    password: str = Field(
        min_length=1,
        max_length=128,
    )


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool
    client_id: int | None = None
    permissions: UserPermissionsSchema | None = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
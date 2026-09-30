from pydantic import BaseModel, EmailStr, Field


# ============================================================
# SIGNUP
# ============================================================

class SignupRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50,
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
    first_login: bool = False


# ============================================================
# LOGIN
# ============================================================

class LoginRequest(BaseModel):
    username: str

    password: str = Field(
        min_length=1,
        max_length=128,
    )


from app.user.user_schema import UserPermissionsSchema


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool
    client_id: int | None = None
    first_login: bool = False
    permissions: UserPermissionsSchema | None = None



class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


# ============================================================
# REFRESH
# ============================================================

class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


# ============================================================
# FIRST-TIME LOGIN PASSWORD CHANGE
# ============================================================

class FirstLoginPasswordChangeRequest(BaseModel):
    new_password: str = Field(
        min_length=8,
        max_length=128,
        description="New password to set for the account",
    )


class FirstLoginPasswordResponse(BaseModel):
    message: str
    user: UserResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserPermissionsSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    can_view_cases: bool = True
    can_create_case: bool = True
    can_upload_files: bool = True
    can_delete_files: bool = True
    can_view_reports: bool = True
    can_view_io: bool = True
    can_create_io: bool = True
    can_update_io: bool = True
    can_delete_io: bool = True


class UserPermissionsUpdateRequest(BaseModel):
    can_view_cases: bool = True
    can_create_case: bool = True
    can_upload_files: bool = True
    can_delete_files: bool = True
    can_view_reports: bool = True
    can_view_io: bool = True
    can_create_io: bool = True
    can_update_io: bool = True
    can_delete_io: bool = True


class UserCreateRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=100,
    )

    email: EmailStr

    password: str = Field(
        min_length=6,
        max_length=128,
    )

    client_id: int | None = None

    permissions: UserPermissionsSchema | None = None


class UserUpdateStatusRequest(BaseModel):
    is_active: bool


class UserResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool
    client_id: int | None = None
    first_login: bool = False
    permissions: UserPermissionsSchema | None = None


class UserQuotaInfo(BaseModel):
    used_seats: int
    max_seats: int
    remaining_seats: int
    active_users: int | None = None
    max_users: int | None = None
    client_id: int | None = None
    client_name: str | None = None
    is_limit_reached: bool = False
    total_licenses: int | None = None
    inactive_users: int | None = 0
    available_licenses: int | None = None
    today_login_count: int | None = 0
    total_users: int | None = 0


class UserListResponse(BaseModel):
    items: list[UserResponse]
    users: list[UserResponse] = []
    total: int
    quota: UserQuotaInfo | None = None
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserPermissionsSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    can_create_case: bool = True
    can_upload_files: bool = True
    can_update_files: bool = True
    can_delete_files: bool = True


class UserPermissionsUpdateRequest(BaseModel):
    can_create_case: bool
    can_upload_files: bool
    can_update_files: bool
    can_delete_files: bool


class UserCreateRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50,
        description="Username for the new user",
    )
    email: EmailStr = Field(
        description="Email address for the new user",
    )
    password: str = Field(
        min_length=6,
        max_length=128,
        description="Temporary initial password",
    )
    client_id: int | None = Field(
        default=None,
        description="Client ID (only applicable if created by Superadmin)",
    )
    permissions: UserPermissionsSchema | None = Field(
        default=None,
        description="Custom access rights for this user",
    )


class UserUpdateStatusRequest(BaseModel):
    is_active: bool = Field(
        description="Activate (True) or Deactivate (False) user access",
    )


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


class UserListResponse(BaseModel):
    items: list[UserResponse]
    users: list[UserResponse] = []
    total: int
    quota: UserQuotaInfo | None = None
from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, model_validator


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
    can_bank_statement_analysis: bool = False
    can_ncrp_statement_analysis: bool = False
    can_gst_advance_search: bool = False
    can_cin_advance_search: bool = False

    @computed_field
    @property
    def gst_advance_search(self) -> bool:
        return self.can_gst_advance_search

    @computed_field
    @property
    def cin_advance_search(self) -> bool:
        return self.can_cin_advance_search


class UserPermissionsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    can_view_cases: bool = True
    can_create_case: bool = True
    can_upload_files: bool = True
    can_delete_files: bool = True
    can_view_reports: bool = True
    can_view_io: bool = True
    can_create_io: bool = True
    can_update_io: bool = True
    can_delete_io: bool = True
    can_bank_statement_analysis: bool = False
    can_ncrp_statement_analysis: bool = False
    can_gst_advance_search: bool = False
    can_cin_advance_search: bool = False
    gst_advance_search: bool | None = None
    cin_advance_search: bool | None = None

    @model_validator(mode="after")
    def sync_fact_permission_keys(self):
        if self.gst_advance_search is not None:
            self.can_gst_advance_search = bool(self.gst_advance_search)
        if self.cin_advance_search is not None:
            self.can_cin_advance_search = bool(self.cin_advance_search)
        return self


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


class UserUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=100)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
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
    client_name: str | None = None
    company_code: str | None = None
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

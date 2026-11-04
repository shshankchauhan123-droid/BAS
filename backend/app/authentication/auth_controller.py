from sqlalchemy.orm import Session

from app.authentication.auth_schema import (
    FirstLoginPasswordRequest,
    FirstLoginResponse,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    SignupRequest,
    SignupResponse,
    UserResponse,
    LastLoginResponse,
)
from app.authentication.auth_service import (
    change_first_login_password,
    dismiss_first_login,
    login_user,
    signup_user,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.user.user_model import User
from app.user.user_repository import get_user_by_id
from app.user.user_schema import UserPermissionsSchema


def _format_user_response(user: User) -> UserResponse:

    if getattr(user, "permissions", None):
        perms_schema = UserPermissionsSchema.model_validate(
            user.permissions
        )
    else:
        # Superadmin / admin has full application permissions.
        if str(user.role).lower() in {"superadmin", "admin"}:
            perms_schema = UserPermissionsSchema(
                can_view_cases=True,
                can_create_case=True,
                can_upload_files=True,
                can_delete_files=True,
                can_view_reports=True,
                can_view_io=True,
                can_create_io=True,
                can_update_io=True,
                can_delete_io=True,
                can_bank_statement_analysis=True,
                can_ncrp_statement_analysis=True,
                can_gst_advance_search=True,
                can_cin_advance_search=True,
            )
        else:
            perms_schema = None

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        client_id=user.client_id,
        permissions=perms_schema,
        first_login=user.first_login,
    )


def signup(
    db: Session,
    data: SignupRequest,
) -> SignupResponse:

    user = signup_user(
        db=db,
        username=data.username,
        email=data.email,
        password=data.password,
    )

    return SignupResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        client_id=user.client_id,
    )


def login(
    db: Session,
    data: LoginRequest,
    ip_address: str | None = None,
) -> LoginResponse:

    user = login_user(
        db=db,
        username=data.username,
        password=data.password,
        company_code=data.company_code,
        ip_address=ip_address,
    )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    refresh_token = create_refresh_token(
        user_id=user.id,
        role=user.role,
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=_format_user_response(user),
    )


def refresh_access_token(
    db: Session,
    data: RefreshTokenRequest,
) -> RefreshTokenResponse:

    try:
        payload = decode_refresh_token(data.refresh_token)

        user_id = payload.get("sub")

        if user_id is None:
            raise ValueError("Invalid refresh token")

        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            raise ValueError(
                "Invalid user ID in refresh token"
            )

    except ValueError:
        raise ValueError(
            "Invalid or expired refresh token"
        )

    user = get_user_by_id(
        db=db,
        user_id=user_id,
    )

    if not user:
        raise ValueError("User not found")

    if not user.is_active:
        raise ValueError("User account is inactive")

    new_access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    new_refresh_token = create_refresh_token(
        user_id=user.id,
        role=user.role,
    )

    return RefreshTokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )


def change_first_login_password_controller(
    db: Session,
    current_user: User,
    data: FirstLoginPasswordRequest,
) -> FirstLoginResponse:

    updated_user = change_first_login_password(
        db=db,
        user=current_user,
        new_password=data.new_password,
    )

    return FirstLoginResponse(
        message="Password updated successfully",
        user=_format_user_response(updated_user),
    )


def dismiss_first_login_controller(
    db: Session,
    current_user: User,
) -> FirstLoginResponse:

    updated_user = dismiss_first_login(
        db=db,
        user=current_user,
    )

    return FirstLoginResponse(
        message="First login dismissed",
        user=_format_user_response(updated_user),
    )

def get_last_login_controller(
    db: Session,
    current_user: User,
) -> LastLoginResponse:
    from app.audit.audit_service import get_user_last_login

    last_login_dt = get_user_last_login(db=db, user_id=current_user.id)
    formatted_str = None

    if last_login_dt is not None:
        try:
            import zoneinfo
            ist = zoneinfo.ZoneInfo("Asia/Kolkata")
        except Exception:
            from datetime import timedelta, timezone
            ist = timezone(timedelta(hours=5, minutes=30))

        if last_login_dt.tzinfo is None:
            from datetime import timezone
            dt_utc = last_login_dt.replace(tzinfo=timezone.utc)
        else:
            dt_utc = last_login_dt

        dt_ist = dt_utc.astimezone(ist)
        formatted_str = dt_ist.strftime("%d %b %Y, %I:%M %p")

    return LastLoginResponse(
        success=True,
        user_id=current_user.id,
        username=current_user.username,
        last_login=last_login_dt,
        last_login_at=last_login_dt,
        formatted_last_login=formatted_str,
    )

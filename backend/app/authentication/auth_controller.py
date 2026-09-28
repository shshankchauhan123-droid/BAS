from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)

from app.authentication.auth_schema import (
    LoginRequest,
    LoginResponse,
    SignupRequest,
    SignupResponse,
    UserResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
)

from app.authentication.auth_service import (
    login_user,
    signup_user,
)

from app.user.user_repository import get_user_by_id


# ============================================================
# SIGNUP
# ============================================================

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
    )


# ============================================================
# LOGIN
# ============================================================

def login(
    db: Session,
    data: LoginRequest,
) -> LoginResponse:

    user = login_user(
        db=db,
        username=data.username,
        password=data.password,
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
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
        ),
    )


# ============================================================
# REFRESH TOKEN
# ============================================================

def refresh_access_token(
    db: Session,
    data: RefreshTokenRequest,
) -> RefreshTokenResponse:

    try:
        payload = decode_refresh_token(
            data.refresh_token
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise ValueError(
                "Invalid refresh token"
            )

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
        raise ValueError(
            "User not found"
        )

    if not user.is_active:
        raise ValueError(
            "User account is inactive"
        )

    new_access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    # Rotate refresh token as well.
    new_refresh_token = create_refresh_token(
        user_id=user.id,
        role=user.role,
    )

    return RefreshTokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )
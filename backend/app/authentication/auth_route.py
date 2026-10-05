from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.authentication.auth_controller import (
    change_first_login_password_controller,
    dismiss_first_login_controller,
    login,
    refresh_access_token,
    signup,
)
from app.authentication.auth_schema import (
    FirstLoginPasswordRequest,
    FirstLoginResponse,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    SignupRequest,
    SignupResponse,
)
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.user.user_model import User


router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)


# ============================================================
# SIGNUP
# ============================================================

@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup_route(
    data: SignupRequest,
    db: Session = Depends(get_db),
):
    try:
        return signup(
            db=db,
            data=data,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
)
def login_route(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    try:
        return login(
            db=db,
            data=data,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        )


# ============================================================
# REFRESH TOKEN
# ============================================================

@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    status_code=status.HTTP_200_OK,
)
def refresh_route(
    data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    try:
        return refresh_access_token(
            db=db,
            data=data,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        )


# ============================================================
# FIRST LOGIN
# ============================================================

@router.post(
    "/first-login-password",
    response_model=FirstLoginResponse,
    status_code=status.HTTP_200_OK,
)
def change_first_login_password_route(
    data: FirstLoginPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return change_first_login_password_controller(
            db=db,
            current_user=current_user,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.post(
    "/dismiss-first-login",
    response_model=FirstLoginResponse,
    status_code=status.HTTP_200_OK,
)
def dismiss_first_login_route(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return dismiss_first_login_controller(
            db=db,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
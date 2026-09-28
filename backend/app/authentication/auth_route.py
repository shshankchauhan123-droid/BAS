from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.core.database import get_db

from app.authentication.auth_controller import (
    login,
    signup,
    refresh_access_token,
)

from app.authentication.auth_schema import (
    LoginRequest,
    LoginResponse,
    SignupRequest,
    SignupResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
)


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
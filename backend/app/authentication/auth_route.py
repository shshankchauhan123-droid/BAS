from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy.orm import Session

from app.authentication.auth_controller import (
    change_first_login_password_controller,
    dismiss_first_login_controller,
    get_last_login_controller,
    login,
    refresh_access_token,
    signup,
)
from app.authentication.auth_service import AuthException
from app.authentication.auth_schema import (
    FirstLoginPasswordRequest,
    FirstLoginResponse,
    LastLoginResponse,
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
    request: Request = None,
    db: Session = Depends(get_db),
):
    ip_address = None
    if request and hasattr(request, "client") and request.client:
        ip_address = request.client.host

    try:
        response = login(
            db=db,
            data=data,
            ip_address=ip_address,
        )

        # Notify active Admin dashboards of the successful login via WebSocket
        try:
            from app.websocket.connection_manager import manager
            client_id = getattr(response.user, "client_id", None)
            manager.trigger_dashboard_refresh(client_id=client_id)
        except Exception:
            pass

        return response

    except AuthException as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={
                "code": error.code,
                "message": error.message,
            },
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": str(error),
            },
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
            detail={
                "code": "SESSION_EXPIRED",
                "message": str(error),
            },
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

# ============================================================
# LAST LOGIN
# ============================================================

@router.get(
    "/last-login",
    response_model=LastLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Get last successful login timestamp for current authenticated user",
)
def get_last_login_route(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return get_last_login_controller(
            db=db,
            current_user=current_user,
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error),
        )

# ============================================================
# LOGOUT
# ============================================================

@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout user and record audit log",
)
def logout_route(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        from app.audit.audit_service import record_audit_log
        ip_address = request.client.host if request and request.client else None
        user_agent = request.headers.get("user-agent") if request else None

        record_audit_log(
            db=db,
            action="USER_LOGOUT",
            entity_type="user",
            entity_id=str(current_user.id),
            entity_name=current_user.username,
            description=f"User '{current_user.username}' logged out",
            actor=current_user,
            client_id=current_user.client_id,
            details={"role": str(current_user.role).lower(), "email": current_user.email},
            ip_address=ip_address,
            user_agent=user_agent,
            module="AUTH",
            status="SUCCESS",
        )
    except Exception:
        pass

    return {"success": True, "message": "Logged out successfully"}


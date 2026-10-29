from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.gst.gst_schema import GstAdvanceSearchRequest
from app.gst.gst_service import execute_gst_advance_search

router = APIRouter(
    tags=["GST Advance Search"],
)


@router.post(
    "/api/v1/gst/advance-search",
    response_model=Dict[str, Any],
    summary="Search GST details using external FACT GST Advance Search API",
)
@router.post(
    "/api/gst/advance-search",
    response_model=Dict[str, Any],
    summary="Alias: Search GST details using external FACT GST Advance Search API",
)
async def advance_search_endpoint(
    request: GstAdvanceSearchRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search GSTIN details via FACT GST Advance Search API.
    All credentials and external API settings are securely loaded from backend .env.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account cannot perform GST search.",
        )

    # Authorization Check: SuperAdmin, Admin, and ClientAdmin have access by role.
    # Regular users require explicit can_gst_advance_search permission.
    user_role = str(current_user.role or "").lower()
    has_permission = False

    if user_role in {"superadmin", "admin", "client_admin"}:
        has_permission = True
    elif getattr(current_user, "permissions", None):
        has_permission = bool(
            getattr(current_user.permissions, "can_gst_advance_search", False)
        )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to access FACT GST Advance Search. Please contact your Client Administrator.",
        )

    return await execute_gst_advance_search(request)

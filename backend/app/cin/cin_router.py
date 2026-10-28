from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.cin.cin_schema import CinSearchQuery
from app.cin.cin_service import execute_cin_advance_search

router = APIRouter(
    tags=["CIN Advance Search"],
)


@router.get(
    "/api/v1/cin/advance-search",
    response_model=Dict[str, Any],
    summary="Search company details using external FACT CIN Details API",
)
@router.get(
    "/api/cin/advance-search",
    response_model=Dict[str, Any],
    summary="Alias: Search company details using external FACT CIN Details API",
)
async def advance_search_endpoint(
    searchNumber: str = Query(
        ...,
        alias="searchNumber",
        min_length=3,
        max_length=35,
        pattern=r"^[A-Za-z0-9\-_/]{3,35}$",
        description="Company Identification Number (CIN), LLPIN, or registration search identifier (e.g. ADB-0675 or U72200TG2020PTC123456)",
    ),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search company details via FACT CIN NewCINDetails API.
    All credentials and external API settings are securely loaded from backend .env.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account cannot perform CIN search.",
        )

    # Authorization Check: SuperAdmin, Admin, and ClientAdmin have access by role.
    # Regular users require explicit can_cin_advance_search permission.
    user_role = str(current_user.role or "").lower()
    has_permission = False

    if user_role in {"superadmin", "admin", "client_admin"}:
        has_permission = True
    elif getattr(current_user, "permissions", None):
        has_permission = bool(
            getattr(current_user.permissions, "can_cin_advance_search", False)
        )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to access FACT CIN Advance Search. Please contact your Client Administrator.",
        )

    clean_search = searchNumber.strip()
    return await execute_cin_advance_search(clean_search)

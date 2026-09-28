from sqlalchemy.orm import Session

from app.user.user_schema import UserResponse
from app.user.user_service import (
    get_user_details,
)


def get_user_by_id(
    db: Session,
    user_id: int,
) -> UserResponse:

    user = get_user_details(
        db=db,
        user_id=user_id,
    )

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
    )
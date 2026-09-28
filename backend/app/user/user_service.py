from sqlalchemy.orm import Session

from app.user.user_model import User
from app.user.user_repository import (
    get_user_by_id,
)


def get_user_details(
    db: Session,
    user_id: int,
) -> User:

    user = get_user_by_id(
        db=db,
        user_id=user_id,
    )

    if not user:
        raise ValueError(
            "User not found"
        )

    return user
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.user.user_controller import get_user_by_id
from app.core.database import get_db
from app.user.user_schema import UserResponse


router = APIRouter(
    prefix="/api/v1/users",
    tags=["User Management"],
)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def get_user_route(
    user_id: int,
    db: Session = Depends(get_db),
):
    try:
        return get_user_by_id(
            db=db,
            user_id=user_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


        a
from sqlalchemy.orm import Session

from app.io_master.io_master_schema import (
    IOMasterCreateRequest,
    IOMasterUpdateRequest,
)
from app.io_master.io_master_service import (
    create_io_service,
    get_ios_service,
    get_io_service,
    update_io_service,
    delete_io_service,
)


from app.user.user_model import User


def create_io_controller(
    db: Session,
    data: IOMasterCreateRequest,
    actor: User,
    target_user_id: int | None = None,
):
    io = create_io_service(
        db=db,
        data=data,
        actor=actor,
        target_user_id=target_user_id,
    )

    return {
        "success": True,
        "message": "Investigating Officer created successfully",
        "data": io,
    }


def get_ios_controller(
    db: Session,
    actor: User,
    target_user_id: int | None = None,
):
    ios = get_ios_service(
        db=db,
        actor=actor,
        target_user_id=target_user_id,
    )

    return {
        "success": True,
        "message": "Investigating Officers fetched successfully",
        "total": len(ios),
        "data": ios,
    }


def get_io_controller(
    db: Session,
    io_id: int,
    actor: User,
):
    io = get_io_service(
        db=db,
        io_id=io_id,
        actor=actor,
    )

    return {
        "success": True,
        "message": "Investigating Officer fetched successfully",
        "data": io,
    }


def update_io_controller(
    db: Session,
    io_id: int,
    data: IOMasterUpdateRequest,
    user_id: int,
):
    io = update_io_service(
        db=db,
        io_id=io_id,
        data=data,
        user_id=user_id,
    )

    return {
        "success": True,
        "message": "Investigating Officer updated successfully",
        "data": io,
    }


def delete_io_controller(
    db: Session,
    io_id: int,
    user_id: int,
):
    delete_io_service(
        db=db,
        io_id=io_id,
        user_id=user_id,
    )

    return {
        "success": True,
        "message": "Investigating Officer deleted successfully",
    }

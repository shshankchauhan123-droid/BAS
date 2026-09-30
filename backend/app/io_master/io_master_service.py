from sqlalchemy.orm import Session

from app.io_master.io_master_model import IOMaster
from app.io_master.io_master_repository import (
    create_io as repository_create_io,
    get_ios_by_user,
    get_io_by_id_and_user,
    update_io as repository_update_io,
    delete_io as repository_delete_io,
)
from app.io_master.io_master_schema import (
    IOMasterCreateRequest,
    IOMasterUpdateRequest,
)


def create_io_service(
    db: Session,
    data: IOMasterCreateRequest,
    user_id: int,
) -> IOMaster:
    officer_name = data.officer_name.strip()
    designation = data.designation.strip()
    police_station = data.police_station.strip()

    if not officer_name:
        raise ValueError("Officer name is required.")

    if not designation:
        raise ValueError("Designation is required.")

    if not police_station:
        raise ValueError("Police station / branch is required.")

    new_io = IOMaster(
        officer_name=officer_name,
        designation=designation,
        police_station=police_station,
        created_by=user_id,
    )

    return repository_create_io(
        db=db,
        io=new_io,
    )


def get_ios_service(
    db: Session,
    user_id: int,
) -> list[IOMaster]:
    return get_ios_by_user(
        db=db,
        user_id=user_id,
    )


def get_io_service(
    db: Session,
    io_id: int,
    user_id: int,
) -> IOMaster:
    io = get_io_by_id_and_user(
        db=db,
        io_id=io_id,
        user_id=user_id,
    )

    if not io:
        raise ValueError("Investigating Officer not found.")

    return io


def update_io_service(
    db: Session,
    io_id: int,
    data: IOMasterUpdateRequest,
    user_id: int,
) -> IOMaster:
    io = get_io_service(
        db=db,
        io_id=io_id,
        user_id=user_id,
    )

    if data.officer_name is not None:
        officer_name = data.officer_name.strip()
        if not officer_name:
            raise ValueError("Officer name cannot be empty.")
        io.officer_name = officer_name

    if data.designation is not None:
        designation = data.designation.strip()
        if not designation:
            raise ValueError("Designation cannot be empty.")
        io.designation = designation

    if data.police_station is not None:
        police_station = data.police_station.strip()
        if not police_station:
            raise ValueError("Police station cannot be empty.")
        io.police_station = police_station

    return repository_update_io(
        db=db,
        io=io,
    )


def delete_io_service(
    db: Session,
    io_id: int,
    user_id: int,
) -> None:
    io = get_io_service(
        db=db,
        io_id=io_id,
        user_id=user_id,
    )

    repository_delete_io(
        db=db,
        io=io,
    )

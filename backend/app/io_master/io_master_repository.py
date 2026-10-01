from typing import Optional
from sqlalchemy.orm import Session

from app.io_master.io_master_model import IOMaster


def create_io(
    db: Session,
    io: IOMaster,
) -> IOMaster:
    db.add(io)
    db.commit()
    db.refresh(io)
    return io


def get_ios_by_user(
    db: Session,
    user_id: int,
) -> list[IOMaster]:
    return (
        db.query(IOMaster)
        .filter(IOMaster.created_by == user_id)
        .order_by(IOMaster.officer_name.asc())
        .all()
    )


def get_io_by_id_and_user(
    db: Session,
    io_id: int,
    user_id: int,
) -> Optional[IOMaster]:
    return (
        db.query(IOMaster)
        .filter(
            IOMaster.id == io_id,
            IOMaster.created_by == user_id,
        )
        .first()
    )


def get_io_by_id(
    db: Session,
    io_id: int,
) -> Optional[IOMaster]:
    return (
        db.query(IOMaster)
        .filter(IOMaster.id == io_id)
        .first()
    )


def update_io(
    db: Session,
    io: IOMaster,
) -> IOMaster:
    db.commit()
    db.refresh(io)
    return io


def delete_io(
    db: Session,
    io: IOMaster,
) -> None:
    db.delete(io)
    db.commit()

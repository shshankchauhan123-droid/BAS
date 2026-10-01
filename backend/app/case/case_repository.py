from typing import Optional
from sqlalchemy.orm import Session, joinedload

from app.case.case_model import Case


def create_case(
    db: Session,
    case: Case,
) -> Case:
    db.add(case)
    db.commit()
    db.refresh(case)

    return case


def get_all_cases(
    db: Session,
) -> list[Case]:
    return (
        db.query(Case)
        .order_by(Case.created_at.desc())
        .all()
    )


def get_cases_by_user(
    db: Session,
    user_id: int,
) -> list[Case]:
    return (
        db.query(Case)
        .options(joinedload(Case.io))
        .filter(Case.created_by == user_id)
        .order_by(Case.created_at.desc())
        .all()
    )


def get_case_by_id(
    db: Session,
    case_id: int,
) -> Optional[Case]:
    return (
        db.query(Case)
        .options(joinedload(Case.io))
        .filter(Case.id == case_id)
        .first()
    )


def get_case_by_id_and_user(
    db: Session,
    case_id: int,
    user_id: int,
) -> Optional[Case]:
    return (
        db.query(Case)
        .options(joinedload(Case.io))
        .filter(
            Case.id == case_id,
            Case.created_by == user_id,
        )
        .first()
    )


def get_last_case(
    db: Session,
) -> Optional[Case]:
    return (
        db.query(Case)
        .order_by(Case.id.desc())
        .first()
    )


def update_case(
    db: Session,
    case: Case,
) -> Case:
    db.commit()
    db.refresh(case)
    return case
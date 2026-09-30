from datetime import datetime

from sqlalchemy.orm import Session

from app.case.case_model import Case
from app.case.case_repository import (
    create_case as repository_create_case,
    get_cases_by_user,
    get_case_by_id_and_user,
    get_last_case,
    update_case as repository_update_case,
)
from app.case.case_schema import (
    CaseCreateRequest,
    CaseUpdateRequest,
)


def generate_case_number(db: Session) -> str:
    current_year = datetime.now().year

    last_case = get_last_case(db)

    if last_case:
        next_number = last_case.id + 1
    else:
        next_number = 1

    return f"BAS-{current_year}-{next_number:06d}"


def create_case(
    db: Session,
    data: CaseCreateRequest,
    user_id: int,
):
    from app.io_master.io_master_repository import (
        get_ios_by_user,
        get_io_by_id_and_user,
    )

    user_ios = get_ios_by_user(db=db, user_id=user_id)

    # Compulsory: User must create an IO first before creating their first case
    if not user_ios:
        raise ValueError(
            "No Investigating Officer found. You must create an Investigating Officer (IO) first before creating your first case."
        )

    assigned_io_id = data.io_id
    if assigned_io_id:
        io = get_io_by_id_and_user(db=db, io_id=assigned_io_id, user_id=user_id)
        if not io:
            raise ValueError("Selected Investigating Officer not found.")
    else:
        # Subsequent cases: Default to the user's existing IO if not explicitly specified
        assigned_io_id = user_ios[0].id

    case_number = generate_case_number(db)

    new_case = Case(
        case_number=case_number,
        case_name=data.case_name.strip(),
        description=(
            data.description.strip()
            if data.description
            else None
        ),
        status="DRAFT",
        created_by=user_id,
        io_id=assigned_io_id,
    )

    return repository_create_case(
        db=db,
        case=new_case,
    )


def get_cases(
    db: Session,
    user_id: int,
):
    return get_cases_by_user(
        db=db,
        user_id=user_id,
    )


def get_case(
    db: Session,
    case_id: int,
    user_id: int,
):
    return get_case_by_id_and_user(
        db=db,
        case_id=case_id,
        user_id=user_id,
    )


def update_case(
    db: Session,
    case_id: int,
    data: CaseUpdateRequest,
    user_id: int,
):
    case = get_case_by_id_and_user(
        db=db,
        case_id=case_id,
        user_id=user_id,
    )

    if not case:
        raise ValueError("Case not found")

    if data.case_name is not None:
        case.case_name = data.case_name.strip()

    if data.description is not None:
        case.description = data.description.strip()

    if data.status is not None:
        allowed_statuses = {
            "DRAFT",
            "ACTIVE",
            "PROCESSING",
            "COMPLETED",
            "ARCHIVED",
        }

        status_value = data.status.upper()

        if status_value not in allowed_statuses:
            raise ValueError("Invalid case status")

        case.status = status_value

    if data.io_id is not None:
        case.io_id = data.io_id

    return repository_update_case(
        db=db,
        case=case,
    )


def delete_case(
    db: Session,
    case_id: int,
    user_id: int,
):
    case = get_case_by_id_and_user(
        db=db,
        case_id=case_id,
        user_id=user_id,
    )

    if not case:
        raise ValueError("Case not found")

    case.status = "ARCHIVED"

    repository_update_case(
        db=db,
        case=case,
    )

    return {
        "id": case.id,
        "case_number": case.case_number,
        "status": case.status,
    }
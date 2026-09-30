from datetime import datetime

from sqlalchemy.orm import Session

from app.case.case_model import Case
from app.case.case_repository import (
    create_case as repository_create_case,
    get_all_cases,
    get_case_by_id,
    get_case_by_id_and_user,
    get_cases_by_user,
    get_last_case,
    update_case as repository_update_case,
)
from app.case.case_schema import (
    CaseCreateRequest,
    CaseUpdateRequest,
)
from app.core.roles import ADMIN_ROLE, SUPERADMIN_ROLE, USER_ROLE
from app.user.user_model import User


def is_superadmin(user: User) -> bool:
    return str(user.role).lower() in {SUPERADMIN_ROLE, ADMIN_ROLE}


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
    user: User,
):
    user_role = str(user.role).lower()
    if user_role == USER_ROLE:
        perms = getattr(user, "permissions", None)
        if perms and not perms.can_create_case:
            raise PermissionError("You do not have permission to create cases. Contact your company administrator.")

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
        created_by=user.id,
        client_id=user.client_id,
    )

    return repository_create_case(
        db=db,
        case=new_case,
    )



def get_cases(
    db: Session,
    user: User,
):
    user_role = str(user.role).lower()

    # SuperAdmin has global visibility across all cases
    if user_role in {SUPERADMIN_ROLE, "admin"}:
        return get_all_cases(db=db)

    # Regular users strictly see only the cases they created
    elif user_role == USER_ROLE:
        return get_cases_by_user(
            db=db,
            user_id=user.id,
        )

    # Client Admins do not have access to user cases
    return []


def get_case(
    db: Session,
    case_id: int,
    user: User,
):
    user_role = str(user.role).lower()

    if user_role in {SUPERADMIN_ROLE, "admin"}:
        return get_case_by_id(db=db, case_id=case_id)
    elif user_role == USER_ROLE:
        return get_case_by_id_and_user(
            db=db,
            case_id=case_id,
            user_id=user.id,
        )
    return None


def update_case(
    db: Session,
    case_id: int,
    data: CaseUpdateRequest,
    user: User,
):
    user_role = str(user.role).lower()
    if user_role not in {SUPERADMIN_ROLE, "admin"}:
        raise PermissionError("Parent case details cannot be modified once created. All updates must be made to items under this case.")

    case = get_case(db=db, case_id=case_id, user=user)

    if not case:
        raise ValueError("Case not found or permission denied")

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

        status_value = data.status.strip().upper()

        if status_value not in allowed_statuses:
            raise ValueError("Invalid case status")

        case.status = status_value

    return repository_update_case(
        db=db,
        case=case,
    )


def delete_case(
    db: Session,
    case_id: int,
    user: User,
):
    raise PermissionError("Cases cannot be deleted once created to ensure data and audit trail integrity.")

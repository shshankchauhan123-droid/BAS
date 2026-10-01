from datetime import datetime

from sqlalchemy.orm import Session

from app.audit.audit_service import record_audit_log
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
from app.core.roles import ADMIN_ROLE, CLIENT_ADMIN_ROLE, SUPERADMIN_ROLE, USER_ROLE
from app.user.user_model import User
from app.user.user_repository import get_user_by_id


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
    user_id: int,
):
    user = get_user_by_id(db=db, user_id=user_id)
    if not user:
        raise ValueError("User not found.")

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
        created_by=user.id,
        client_id=user.client_id,
    )

    created = repository_create_case(
        db=db,
        case=new_case,
    )

    record_audit_log(
        db=db,
        actor=user,
        action="CASE_CREATED",
        entity_type="case",
        entity_id=str(created.id),
        entity_name=created.case_number,
        description=f"User {user.username} created case '{created.case_name}' ({created.case_number})",
        details={
            "case_number": created.case_number,
            "case_name": created.case_name,
            "status": created.status,
            "client_id": created.client_id,
        },
        client_id=created.client_id,
    )

    return created



def get_cases(
    db: Session,
    user_id: int,
):
    user = get_user_by_id(db=db, user_id=user_id)
    if not user:
        return []

    user_role = str(user.role).lower()

    # SuperAdmin has global visibility across all cases
    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
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
    user_id: int,
):
    user = get_user_by_id(db=db, user_id=user_id)
    if not user:
        return None

    user_role = str(user.role).lower()

    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
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
    user_id: int,
):
    user = get_user_by_id(db=db, user_id=user_id)
    if not user:
        raise ValueError("User not found.")

    user_role = str(user.role).lower()

    # CRITICAL: ONLY Superadmin can archive a case across ALL update paths
    is_attempting_archive = (
        data.status is not None and data.status.strip().upper() == "ARCHIVED"
    )
    if is_attempting_archive and not is_superadmin(user):
        record_audit_log(
            db=db,
            actor=user,
            action="CASE_ARCHIVE_DENIED",
            entity_type="case",
            entity_id=str(case_id),
            entity_name=None,
            description=f"Unauthorized attempt by {user.username} ({user.role}) to archive Case ID {case_id}",
            details={"attempted_status": "ARCHIVED", "path": "PUT /api/v1/cases/{case_id}"},
            client_id=user.client_id,
        )
        raise PermissionError("Only Superadmin can archive a case.")

    # Client Admins do not have permission to modify cases
    if user_role == CLIENT_ADMIN_ROLE:
        raise PermissionError("Client Admins do not have permission to modify cases.")

    case = get_case(db=db, case_id=case_id, user_id=user_id)

    if not case:
        raise ValueError("Case not found or permission denied")

    changed_fields = {}

    if data.case_name is not None and data.case_name.strip() != case.case_name:
        changed_fields["case_name"] = {
            "old": case.case_name,
            "new": data.case_name.strip(),
        }
        case.case_name = data.case_name.strip()

    if data.description is not None:
        new_desc = data.description.strip() if data.description.strip() else None
        if new_desc != case.description:
            changed_fields["description"] = {
                "old": case.description,
                "new": new_desc,
            }
            case.description = new_desc

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

        if status_value == "ARCHIVED" and not is_superadmin(user):
            record_audit_log(
                db=db,
                actor=user,
                action="CASE_ARCHIVE_DENIED",
                entity_type="case",
                entity_id=str(case.id),
                entity_name=case.case_number,
                description=f"Unauthorized attempt by {user.username} ({user.role}) to archive Case {case.case_number}",
                details={"attempted_status": "ARCHIVED", "path": "PUT /api/v1/cases/{case_id}"},
                client_id=case.client_id,
            )
            raise PermissionError("Only Superadmin can archive a case.")

        if status_value != case.status:
            changed_fields["status"] = {
                "old": case.status,
                "new": status_value,
            }
            case.status = status_value

    updated_case = repository_update_case(
        db=db,
        case=case,
    )

    action = "CASE_ARCHIVED" if (data.status and data.status.strip().upper() == "ARCHIVED") else "CASE_UPDATED"
    record_audit_log(
        db=db,
        actor=user,
        action=action,
        entity_type="case",
        entity_id=str(updated_case.id),
        entity_name=updated_case.case_number,
        description=f"{user.role.capitalize()} {user.username} {'archived' if action == 'CASE_ARCHIVED' else 'updated'} case '{updated_case.case_name}' ({updated_case.case_number})",
        details={"changed_fields": changed_fields},
        client_id=updated_case.client_id,
    )

    return updated_case


def delete_case(
    db: Session,
    case_id: int,
    user_id: int,
):
    user = get_user_by_id(db=db, user_id=user_id)
    if not user:
        raise ValueError("User not found.")

    if not is_superadmin(user):
        record_audit_log(
            db=db,
            actor=user,
            action="CASE_ARCHIVE_DENIED",
            entity_type="case",
            entity_id=str(case_id),
            entity_name=None,
            description=f"Unauthorized attempt by {user.username} ({user.role}) to archive/delete Case ID {case_id}",
            details={"path": "DELETE /api/v1/cases/{case_id}"},
            client_id=user.client_id,
        )
        raise PermissionError("Only Superadmin can archive a case.")

    case = get_case_by_id(db=db, case_id=case_id)
    if not case:
        raise ValueError("Case not found")

    old_status = case.status
    case.status = "ARCHIVED"

    repository_update_case(
        db=db,
        case=case,
    )

    record_audit_log(
        db=db,
        actor=user,
        action="CASE_ARCHIVED",
        entity_type="case",
        entity_id=str(case.id),
        entity_name=case.case_number,
        description=f"Superadmin {user.username} archived case '{case.case_name}' ({case.case_number})",
        details={"previous_status": old_status, "new_status": "ARCHIVED"},
        client_id=case.client_id,
    )

    return {
        "id": case.id,
        "case_number": case.case_number,
        "status": case.status,
    }
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

    user_role = str(user.role).lower()

    from app.io_master.io_master_repository import (
        get_ios_by_user,
        get_io_by_id_and_user,
    )

    if user_role == USER_ROLE:
        perms = getattr(user, "permissions", None)
        if perms and perms.can_create_case is False:
            raise PermissionError("You do not have permission to create cases.")

        # Test 2: Normal user cannot assign a case to another user
        if data.assigned_to is not None:
            raise PermissionError("Normal users cannot assign cases to other users.")

        user_ios = get_ios_by_user(db=db, user_id=user.id)
        if not user_ios:
            raise ValueError(
                "No Investigating Officer found. You must create an Investigating Officer (IO) first before creating your first case."
            )

        if data.io_id:
            io = get_io_by_id_and_user(db=db, io_id=data.io_id, user_id=user.id)
            if not io:
                raise ValueError("Selected Investigating Officer not found.")
            assigned_io_id = io.id
        else:
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
            assigned_to=None,
            io_id=assigned_io_id,
            client_id=user.client_id,
        )

        created = repository_create_case(db=db, case=new_case)

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
                "created_by": user.id,
                "assigned_to": None,
                "io_id": assigned_io_id,
                "client_id": created.client_id,
            },
            client_id=created.client_id,
        )

        return created

    elif user_role == CLIENT_ADMIN_ROLE:
        if not user.client_id:
            raise ValueError("Client admin is not associated with any client company.")

        if not data.assigned_to:
            raise ValueError("Assigned user is required.")

        assigned_user = get_user_by_id(db=db, user_id=data.assigned_to)
        if not assigned_user:
            raise ValueError("Assigned user not found.")

        if assigned_user.client_id != user.client_id:
            raise PermissionError("Assigned user does not belong to your company.")

        if str(assigned_user.role).lower() != USER_ROLE:
            raise ValueError("Cases can only be assigned to investigators.")

        if not assigned_user.is_active:
            raise ValueError("Cannot assign a case to an inactive or barred user.")

        user_ios = get_ios_by_user(db=db, user_id=assigned_user.id)
        if not user_ios:
            raise ValueError(
                f"No Investigating Officer found for user '{assigned_user.username}'. An Investigating Officer (IO) must be registered for this user first."
            )

        if data.io_id:
            io = get_io_by_id_and_user(db=db, io_id=data.io_id, user_id=assigned_user.id)
            if not io:
                raise ValueError("Selected Investigating Officer not found for this user.")
            assigned_io_id = io.id
        else:
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
            assigned_to=assigned_user.id,
            io_id=assigned_io_id,
            client_id=user.client_id,
        )

        created = repository_create_case(db=db, case=new_case)

        record_audit_log(
            db=db,
            actor=user,
            action="CASE_CREATED",
            entity_type="case",
            entity_id=str(created.id),
            entity_name=created.case_number,
            description=f"Client Admin {user.username} created case '{created.case_name}' ({created.case_number}) assigned to {assigned_user.username}",
            details={
                "case_number": created.case_number,
                "case_name": created.case_name,
                "status": created.status,
                "created_by": user.id,
                "assigned_to": assigned_user.id,
                "io_id": assigned_io_id,
                "client_id": created.client_id,
            },
            client_id=created.client_id,
        )

        return created

    else:
        # SuperAdmin or Admin
        assigned_to_id = None
        if data.assigned_to:
            target = get_user_by_id(db=db, user_id=data.assigned_to)
            if not target:
                raise ValueError("Assigned user not found.")
            assigned_to_id = target.id

        user_ios = get_ios_by_user(db=db, user_id=user.id)
        assigned_io_id = data.io_id if data.io_id else (user_ios[0].id if user_ios else None)

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
            assigned_to=assigned_to_id,
            io_id=assigned_io_id,
            client_id=user.client_id,
        )

        created = repository_create_case(db=db, case=new_case)

        record_audit_log(
            db=db,
            actor=user,
            action="CASE_CREATED",
            entity_type="case",
            entity_id=str(created.id),
            entity_name=created.case_number,
            description=f"Admin {user.username} created case '{created.case_name}' ({created.case_number})",
            details={
                "case_number": created.case_number,
                "case_name": created.case_name,
                "status": created.status,
                "created_by": user.id,
                "assigned_to": assigned_to_id,
                "io_id": assigned_io_id,
                "client_id": created.client_id,
            },
            client_id=created.client_id,
        )

        return created


def get_cases(
    db: Session,
    user_id: int,
    target_user_id: int | None = None,
):
    user = get_user_by_id(db=db, user_id=user_id)
    if not user:
        return []

    user_role = str(user.role).lower()

    # SuperAdmin has global visibility across all cases
    if user_role in {SUPERADMIN_ROLE, ADMIN_ROLE}:
        if target_user_id:
            from sqlalchemy import or_
            from sqlalchemy.orm import joinedload
            return (
                db.query(Case)
                .options(joinedload(Case.io))
                .filter(
                    or_(
                        Case.created_by == target_user_id,
                        Case.assigned_to == target_user_id,
                    )
                )
                .order_by(Case.created_at.desc())
                .all()
            )
        return get_all_cases(db=db)

    # Regular users strictly see cases they created or that are assigned to them
    elif user_role == USER_ROLE:
        perms = getattr(user, "permissions", None)
        if perms and perms.can_view_cases is False:
            raise PermissionError("You do not have permission to view cases.")
        return get_cases_by_user(
            db=db,
            user_id=user.id,
        )

    # Client Admins see all cases belonging to their company/tenant
    elif user_role == CLIENT_ADMIN_ROLE:
        if not user.client_id:
            return []
        from sqlalchemy.orm import joinedload
        from sqlalchemy import or_
        query = (
            db.query(Case)
            .options(joinedload(Case.io))
            .filter(Case.client_id == user.client_id)
        )
        if target_user_id:
            target_user = get_user_by_id(db=db, user_id=target_user_id)
            if not target_user or target_user.client_id != user.client_id:
                raise ValueError("Target user not found or not in your organization.")
            query = query.filter(
                or_(
                    Case.created_by == target_user_id,
                    Case.assigned_to == target_user_id,
                )
            )
        return query.order_by(Case.created_at.desc()).all()

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
        perms = getattr(user, "permissions", None)
        if perms and perms.can_view_cases is False:
            raise PermissionError("You do not have permission to view cases.")
        return get_case_by_id_and_user(
            db=db,
            case_id=case_id,
            user_id=user.id,
        )
    elif user_role == CLIENT_ADMIN_ROLE:
        case = get_case_by_id(db=db, case_id=case_id)
        if case and case.client_id == user.client_id:
            return case
        return None
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
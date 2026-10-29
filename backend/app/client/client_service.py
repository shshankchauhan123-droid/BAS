import logging
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.client.client_model import Client
from app.client.client_repository import (
    count_active_users_in_client,
    count_users_in_client,
    create_client,
    get_all_clients,
    get_all_clients_with_user_counts,
    get_client_admin,
    get_client_admins_by_client_ids,
    get_client_by_code,
    get_client_by_id,
    get_client_by_name,
    update_client_max_users,
    update_client_profile,
    update_client_status,
)
from app.client.client_schema import (
    ClientAdminCreate,
    ClientCreateRequest,
    ClientUpdateRequest,
)
from app.core.roles import CLIENT_ADMIN_ROLE
from app.core.security import hash_password
from app.user.user_model import User
from app.user.user_repository import (
    get_user_by_email,
)

logger = logging.getLogger(__name__)


def create_client_with_admin(
    db: Session,
    data: ClientCreateRequest,
) -> tuple[Client, User]:
    # 1. Validate Client Name
    existing_name = get_client_by_name(db, data.name)
    if existing_name:
        raise ValueError(f"A client company with name '{data.name}' already exists.")

    # 2. Validate Company Code
    existing_code = get_client_by_code(db, data.company_code)
    if existing_code:
        raise ValueError(
            f"A client company with code '{data.company_code.upper()}' already exists."
        )

    # 3. Validate Admin Username & Email
    admin_data: ClientAdminCreate = data.admin
    cleaned_username = admin_data.username.strip()
    cleaned_email = admin_data.email.strip().lower()

    if get_user_by_email(db, cleaned_email):
        raise ValueError(f"Email '{cleaned_email}' is already in use.")

    try:
        # 4. Create Client
        client = create_client(
            db=db,
            name=data.name,
            company_code=data.company_code,
            max_users=data.max_users,
        )

        # 5. Create Client Admin User
        password_hash = hash_password(admin_data.password)
        admin_user = User(
            client_id=client.id,
            username=cleaned_username,
            email=cleaned_email,
            password_hash=password_hash,
            role=CLIENT_ADMIN_ROLE,
            is_active=True,
            first_login=True,  # Will prompt to change password on first login
        )
        db.add(admin_user)
        db.commit()
        db.refresh(client)
        db.refresh(admin_user)

        return client, admin_user

    except Exception:
        db.rollback()
        raise


def get_all_clients_with_stats(db: Session) -> list[dict]:
    client_rows = get_all_clients_with_user_counts(db)
    if not client_rows:
        return []

    client_ids = [client.id for client, _, _ in client_rows]
    admins_map = get_client_admins_by_client_ids(db, client_ids)

    result = []
    for client, total_users, active_users in client_rows:
        admin_user = admins_map.get(client.id)
        result.append(
            {
                "client": client,
                "current_users_count": total_users,
                "active_users": active_users,
                "admin_email": admin_user.email if admin_user else None,
                "admin_username": admin_user.username if admin_user else None,
            }
        )
    return result


def get_client_by_id_with_stats(db: Session, client_id: int) -> dict:
    client = get_client_by_id(db, client_id)
    if not client:
        raise ValueError(f"Client with ID {client_id} not found.")

    user_count = count_users_in_client(db, client.id)
    active_user_count = count_active_users_in_client(db, client.id)
    admin_user = get_client_admin(db, client.id)
    return {
        "client": client,
        "current_users_count": user_count,
        "active_users": active_user_count,
        "admin_email": admin_user.email if admin_user else None,
        "admin_username": admin_user.username if admin_user else None,
    }


def set_client_status(db: Session, client_id: int, is_active: bool) -> dict:
    client = get_client_by_id(db, client_id)
    if not client:
        raise ValueError(f"Client with ID {client_id} not found.")

    updated_client = update_client_status(db, client, is_active)
    user_count = count_users_in_client(db, client.id)
    active_user_count = count_active_users_in_client(db, client.id)
    admin_user = get_client_admin(db, client.id)
    return {
        "client": updated_client,
        "current_users_count": user_count,
        "active_users": active_user_count,
        "admin_email": admin_user.email if admin_user else None,
        "admin_username": admin_user.username if admin_user else None,
    }


def set_client_max_users(db: Session, client_id: int, max_users: int) -> dict:
    client = get_client_by_id(db, client_id)
    if not client:
        raise ValueError(f"Client with ID {client_id} not found.")

    user_count = count_users_in_client(db, client.id)
    if max_users < user_count:
        raise ValueError(
            f"Cannot decrease limit to {max_users}. Client already has {user_count} registered users."
        )

    updated_client = update_client_max_users(db, client, max_users)
    active_user_count = count_active_users_in_client(db, client.id)
    admin_user = get_client_admin(db, client.id)
    return {
        "client": updated_client,
        "current_users_count": user_count,
        "active_users": active_user_count,
        "admin_email": admin_user.email if admin_user else None,
        "admin_username": admin_user.username if admin_user else None,
    }


def update_client_details(
    db: Session,
    client_id: int,
    data: ClientUpdateRequest,
    actor: User | None = None,
) -> dict:
    client = get_client_by_id(db, client_id)
    if not client:
        raise ValueError(f"Client with ID {client_id} not found.")

    # 1. Validate Client Name if changed
    if data.name is not None:
        clean_name = data.name.strip()
        existing_name = get_client_by_name(db, clean_name)
        if existing_name and existing_name.id != client.id:
            raise ValueError(f"A client company with name '{clean_name}' already exists.")

    # 2. Validate Company Code if changed
    if data.company_code is not None:
        clean_code = data.company_code.strip().upper()
        existing_code = get_client_by_code(db, clean_code)
        if existing_code and existing_code.id != client.id:
            raise ValueError(f"A client company with code '{clean_code}' already exists.")

    # 3. Validate Max Users if provided
    user_count = count_users_in_client(db, client.id)
    if data.max_users is not None and data.max_users < user_count:
        raise ValueError(
            f"Cannot decrease limit to {data.max_users}. Client already has {user_count} registered users."
        )

    # 4. Handle Admin Email / Username updates
    admin_user = get_client_admin(db, client.id)
    if data.admin_email is not None and admin_user:
        clean_email = data.admin_email.strip().lower()
        existing_email_user = get_user_by_email(db, clean_email)
        if existing_email_user and existing_email_user.id != admin_user.id:
            raise ValueError(f"Email '{clean_email}' is already in use by another user.")
        admin_user.email = clean_email

    if data.admin_username is not None and admin_user:
        clean_username = data.admin_username.strip()
        existing_username_user = db.execute(
            select(User).where(
                User.client_id == client.id,
                func.lower(User.username) == clean_username.lower(),
                User.id != admin_user.id,
            )
        ).scalar_one_or_none()
        if existing_username_user:
            raise ValueError(
                f"Username '{clean_username}' is already in use within this client company."
            )
        admin_user.username = clean_username

    # 5. Update Client in DB
    updated_client = update_client_profile(
        db=db,
        client=client,
        name=data.name,
        company_code=data.company_code,
        max_users=data.max_users,
        is_active=data.is_active,
    )

    if admin_user:
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

    active_user_count = count_active_users_in_client(db, client.id)

    # 6. Audit Trail
    try:
        from app.audit.audit_service import record_audit_log
        record_audit_log(
            db=db,
            action="UPDATE",
            entity_type="CLIENT",
            entity_id=client.id,
            entity_name=client.name,
            description=f"Super Admin updated client company '{client.name}' (ID: {client.id}).",
            actor=actor,
            details={
                "name": client.name,
                "company_code": client.company_code,
                "max_users": client.max_users,
                "is_active": client.is_active,
                "admin_email": admin_user.email if admin_user else None,
                "admin_username": admin_user.username if admin_user else None,
            },
        )
    except Exception as audit_err:
        logger.warning(f"Failed to record audit log for client update: {audit_err}")

    return {
        "client": updated_client,
        "current_users_count": user_count,
        "active_users": active_user_count,
        "admin_email": admin_user.email if admin_user else None,
        "admin_username": admin_user.username if admin_user else None,
    }


def delete_client_safely(
    db: Session,
    client_id: int,
    actor: User | None = None,
) -> dict:
    from app.case.case_model import Case
    from app.files.file_model import File
    from app.ncrp.ncrp_model import NcrpFile
    from app.io_master.io_master_model import IOMaster
    from app.user.user_permission_model import UserPermission
    from app.audit.audit_model import AuditLog

    client = get_client_by_id(db, client_id)
    if not client:
        raise ValueError(f"Client with ID {client_id} not found.")

    client_name = client.name

    # 1. Check for dependent investigation cases directly linked to client
    client_cases_count = db.query(func.count(Case.id)).filter(Case.client_id == client.id).scalar() or 0

    # 2. Check users under client
    client_users = db.query(User).filter(User.client_id == client.id).all()
    user_ids = [u.id for u in client_users]

    # 3. Check cases, files, and NCRP records created or assigned to client users
    user_cases_count = 0
    user_files_count = 0
    user_ncrp_count = 0
    user_io_count = 0
    if user_ids:
        user_cases_count = (
            db.query(func.count(Case.id))
            .filter((Case.created_by.in_(user_ids)) | (Case.assigned_to.in_(user_ids)))
            .scalar()
            or 0
        )
        user_files_count = (
            db.query(func.count(File.id))
            .filter(File.created_by.in_(user_ids))
            .scalar()
            or 0
        )
        user_ncrp_count = (
            db.query(func.count(NcrpFile.id))
            .filter(NcrpFile.created_by.in_(user_ids))
            .scalar()
            or 0
        )
        user_io_count = (
            db.query(func.count(IOMaster.id))
            .filter(IOMaster.created_by.in_(user_ids))
            .scalar()
            or 0
        )

    # 4. Check files & NCRP files under any cases belonging to client
    case_ids_subquery = db.query(Case.id).filter(Case.client_id == client.id)
    case_files_count = db.query(func.count(File.id)).filter(File.case_id.in_(case_ids_subquery)).scalar() or 0
    case_ncrp_count = db.query(func.count(NcrpFile.id)).filter(NcrpFile.case_id.in_(case_ids_subquery)).scalar() or 0

    total_cases = max(client_cases_count, user_cases_count)
    total_files = max(user_files_count, case_files_count)
    total_ncrp = max(user_ncrp_count, case_ncrp_count)

    # If any investigation records exist, block permanent deletion!
    if total_cases > 0 or total_files > 0 or total_ncrp > 0 or user_io_count > 0:
        details = []
        if total_cases > 0:
            details.append(f"{total_cases} investigation case(s)")
        if total_files > 0:
            details.append(f"{total_files} bank statement document(s)")
        if total_ncrp > 0:
            details.append(f"{total_ncrp} NCRP statement workbook(s)")
        if user_io_count > 0:
            details.append(f"{user_io_count} Investigating Officer record(s)")
        dependencies_str = ", ".join(details)

        raise ValueError(
            f"Cannot delete client '{client_name}' (ID: {client_id}) because it has associated investigation records: {dependencies_str}. "
            f"Permanent deletion is prevented to protect case evidence and legal audit trails. "
            f"Please deactivate the client instead to immediately revoke access for all company users while preserving data integrity."
        )

    # Safe to delete: client has 0 cases and 0 investigation records
    try:
        # Nullify audit logs foreign keys pointing to this client or its users to preserve audit history
        db.query(AuditLog).filter(AuditLog.client_id == client.id).update(
            {AuditLog.client_id: None}, synchronize_session=False
        )
        if user_ids:
            db.query(AuditLog).filter(AuditLog.user_id.in_(user_ids)).update(
                {AuditLog.user_id: None}, synchronize_session=False
            )
            # Delete user permissions
            db.query(UserPermission).filter(UserPermission.user_id.in_(user_ids)).delete(synchronize_session=False)
            # Delete users
            db.query(User).filter(User.client_id == client.id).delete(synchronize_session=False)

        # Delete client
        db.delete(client)
        db.commit()

        # Audit log
        try:
            from app.audit.audit_service import record_audit_log
            record_audit_log(
                db=db,
                action="DELETE",
                entity_type="CLIENT",
                entity_id=client_id,
                entity_name=client_name,
                description=f"Super Admin permanently deleted client company '{client_name}' (ID: {client_id}) with 0 investigation records.",
                actor=actor,
            )
        except Exception as audit_err:
            logger.warning(f"Failed to record audit log for client deletion: {audit_err}")

        return {
            "success": True,
            "message": f"Client '{client_name}' (ID: {client_id}) and its associated user accounts were deleted successfully.",
            "client_id": client_id,
        }

    except Exception as err:
        db.rollback()
        raise ValueError(f"Database error deleting client '{client_name}': {str(err)}")


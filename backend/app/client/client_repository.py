from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.client.client_model import Client
from app.user.user_model import User
from app.core.roles import CLIENT_ADMIN_ROLE


def get_client_by_id(db: Session, client_id: int) -> Client | None:
    statement = select(Client).where(Client.id == client_id)
    return db.execute(statement).scalar_one_or_none()


def get_client_by_name(db: Session, name: str) -> Client | None:
    statement = select(Client).where(func.lower(Client.name) == name.strip().lower())
    return db.execute(statement).scalar_one_or_none()


def get_client_by_code(db: Session, company_code: str) -> Client | None:
    statement = select(Client).where(
        func.lower(Client.company_code) == company_code.strip().lower()
    )
    return db.execute(statement).scalar_one_or_none()


def get_all_clients(db: Session) -> list[Client]:
    statement = select(Client).order_by(Client.created_at.desc())
    return list(db.execute(statement).scalars().all())


def get_all_clients_with_user_counts(db: Session) -> list[tuple[Client, int, int]]:
    statement = (
        select(
            Client,
            func.count(User.id).label("total_users"),
            func.count(case((User.is_active.is_(True), User.id), else_=None)).label("active_users"),
        )
        .outerjoin(User, Client.id == User.client_id)
        .group_by(Client.id)
        .order_by(Client.created_at.desc())
    )
    return list(db.execute(statement).all())


def get_client_admins_by_client_ids(db: Session, client_ids: list[int]) -> dict[int, User]:
    if not client_ids:
        return {}
    statement = (
        select(User)
        .where(
            User.client_id.in_(client_ids),
            User.role == CLIENT_ADMIN_ROLE,
        )
        .order_by(User.created_at.asc())
    )
    admins = db.execute(statement).scalars().all()
    admin_map: dict[int, User] = {}
    for admin in admins:
        if admin.client_id is not None and admin.client_id not in admin_map:
            admin_map[admin.client_id] = admin
    return admin_map


def count_users_in_client(db: Session, client_id: int) -> int:
    statement = select(func.count(User.id)).where(User.client_id == client_id)
    return db.scalar(statement) or 0


def count_active_users_in_client(db: Session, client_id: int) -> int:
    statement = select(func.count(User.id)).where(
        User.client_id == client_id,
        User.is_active.is_(True),
    )
    return db.scalar(statement) or 0


def get_client_admin(db: Session, client_id: int) -> User | None:
    statement = (
        select(User)
        .where(User.client_id == client_id)
        .where(User.role == CLIENT_ADMIN_ROLE)
        .order_by(User.created_at.asc())
    )
    return db.execute(statement).scalars().first()


def create_client(
    db: Session,
    name: str,
    company_code: str,
    max_users: int,
) -> Client:
    client = Client(
        name=name.strip(),
        company_code=company_code.strip().upper(),
        max_users=max_users,
        is_active=True,
    )
    db.add(client)
    db.flush()
    return client


def update_client_status(
    db: Session,
    client: Client,
    is_active: bool,
) -> Client:
    client.is_active = is_active
    db.commit()
    db.refresh(client)
    return client


def update_client_max_users(

    db: Session,
    client: Client,
    max_users: int,
) -> Client:
    client.max_users = max_users
    db.commit()
    db.refresh(client)
    return client

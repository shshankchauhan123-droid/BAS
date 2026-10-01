from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config, pool
from dotenv import load_dotenv

from alembic import context

from app.core.database import Base
from app.user.user_model import User
from app.case.case_model import Case
from app.files.file_model import File
from app.bank_transactions.bank_transaction_model import BankTransaction
from app.bank_transactions.transaction_mode_model import TransactionMode

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured")


def get_database_url() -> str:
    """
    Return the database URL from the environment.

    Alembic's ConfigParser treats '%' as interpolation syntax,
    so we escape '%' before placing the URL into alembic.ini's
    configuration object.
    """
    return DATABASE_URL.replace("%", "%%")


config.set_main_option(
    "sqlalchemy.url",
    get_database_url(),
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = DATABASE_URL

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
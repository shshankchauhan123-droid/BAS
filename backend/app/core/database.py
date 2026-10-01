from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured")

engine = create_engine(
    DATABASE_URL,
    echo=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_database_schema(db=None):
    from sqlalchemy import text
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass

    for table_name, table in Base.metadata.tables.items():
        for col in table.columns:
            if col.name == "id":
                continue
            col_type = col.type.compile(engine.dialect)
            sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col.name} {col_type}"
            try:
                db.execute(text(sql))
                db.commit()
            except Exception:
                db.rollback()

    if should_close:
        db.close()
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class StatementFormatMapping(Base):
    __tablename__ = "statement_format_mappings"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    format_fingerprint = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )

    bank_name = Column(
        String(255),
        nullable=True,
    )

    mapping_json = Column(
        Text,
        nullable=False,
    )

    confidence = Column(
        String(20),
        nullable=True,
    )

    mapping_source = Column(
        String(50),
        nullable=False,
        default="rule",
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.core.database import Base


class File(Base):
    __tablename__ = "files"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False,
        index=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    original_filename = Column(
        String(255),
        nullable=False,
    )

    stored_filename = Column(
        String(255),
        nullable=False,
    )

    file_path = Column(
        Text,
        nullable=False,
    )

    mime_type = Column(
        String(100),
        nullable=True,
    )

    file_size = Column(
        Integer,
        nullable=False,
    )

    status = Column(
        String(50),
        nullable=False,
        default="UPLOADING",
        index=True,
    )

    raw_excel_path = Column(
        String(255),
        nullable=True,
    )

    processing_stage = Column(
        String(100),
        nullable=True,
    )

    processing_progress = Column(
        String(50),
        nullable=True,
    )

    error_message = Column(
        Text,
        nullable=True,
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
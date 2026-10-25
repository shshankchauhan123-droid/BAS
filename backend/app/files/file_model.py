from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
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

    document_type = Column(
        String(50),
        nullable=False,
        default="BANK_STATEMENT",
        index=True,
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

    account_name = Column(
        String(255),
        nullable=True,
    )

    account_number = Column(
        String(100),
        nullable=True,
    )

    bank_name = Column(
        String(255),
        nullable=True,
    )

    branch_name = Column(
        String(255),
        nullable=True,
    )

    ifsc = Column(
        String(50),
        nullable=True,
    )

    micr = Column(
        String(50),
        nullable=True,
    )

    account_type = Column(
        String(100),
        nullable=True,
    )

    statement_start_date = Column(
        Date,
        nullable=True,
    )

    statement_end_date = Column(
        Date,
        nullable=True,
    )

    is_merged = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    is_superseded = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    superseded_by_file_id = Column(
        Integer,
        ForeignKey("files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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


class MergedFileSource(Base):
    __tablename__ = "merged_file_sources"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    merged_file_id = Column(
        Integer,
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    source_file_id = Column(
        Integer,
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("merged_file_id", "source_file_id", name="uq_merged_file_source"),
    )
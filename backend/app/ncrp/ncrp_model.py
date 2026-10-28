from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from app.core.database import Base


class NcrpFile(Base):
    __tablename__ = "ncrp_file"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
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
        default="PROCESSING",
        index=True,
    )

    error_message = Column(
        Text,
        nullable=True,
    )

    sheet_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    total_rows = Column(
        Integer,
        nullable=False,
        default=0,
    )

    imported_rows = Column(
        Integer,
        nullable=False,
        default=0,
    )

    failed_rows = Column(
        Integer,
        nullable=False,
        default=0,
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

    # Relationships
    case = relationship("Case", backref="ncrp_files")
    creator = relationship("User", backref="created_ncrp_files")
    transactions = relationship(
        "NcrpTransaction",
        back_populates="ncrp_file",
        cascade="all, delete-orphan",
    )


class NcrpTransaction(Base):
    __tablename__ = "ncrp_transactions"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    ncrp_file_id = Column(
        Integer,
        ForeignKey("ncrp_file.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    sheet_name = Column(
        String(255),
        nullable=False,
        index=True,
    )

    row_number = Column(
        Integer,
        nullable=False,
    )

    acknowledgement_no = Column(
        String(100),
        nullable=True,
        index=True,
    )

    account_or_wallet_id = Column(
        String(255),
        nullable=True,
    )

    transaction_id_utr = Column(
        String(255),
        nullable=True,
        index=True,
    )

    transaction_date = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    transaction_amount = Column(
        Numeric(20, 2),
        nullable=True,
    )

    disputed_amount = Column(
        Numeric(20, 2),
        nullable=True,
    )

    bank_name = Column(
        String(255),
        nullable=True,
    )

    layer = Column(
        String(100),
        nullable=True,
    )

    raw_data = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    ncrp_file = relationship("NcrpFile", back_populates="transactions")
    case = relationship("Case")

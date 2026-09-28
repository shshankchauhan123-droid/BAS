from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
)

from app.core.database import Base


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    file_id = Column(
        Integer,
        ForeignKey("files.id"),
        nullable=False,
        index=True,
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False,
        index=True,
    )

    transaction_date = Column(
        Date,
        nullable=True,
        index=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    debit = Column(
        Numeric(20, 2),
        nullable=True,
    )

    credit = Column(
        Numeric(20, 2),
        nullable=True,
    )

    balance = Column(
        Numeric(20, 2),
        nullable=True,
    )

    cheque_number = Column(
        Text,
        nullable=True,
    )

    reference_number = Column(
        Text,
        nullable=True,
    )

    alpha = Column(
        Text,
        nullable=True,
    )

    source_page = Column(
        Integer,
        nullable=True,
    )

    source_row = Column(
        Integer,
        nullable=True,
    )

    extraction_confidence = Column(
        Numeric(5, 4),
        nullable=True,
    )

    raw_narration = Column(
        Text,
        nullable=True,
    )

    raw_row = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
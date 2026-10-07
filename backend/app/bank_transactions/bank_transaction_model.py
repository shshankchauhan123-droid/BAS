from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
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

    account_name = Column(
        String(255),
        nullable=True,
    )

    account_number = Column(
        String(100),
        nullable=True,
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

    cheque_number = Column(
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

    mode = Column(
        Text,
        nullable=True,
    )

    # GLiNER NLP Counterparty Extraction Fields
    counterparty_name = Column(
        String(255),
        nullable=True,
    )

    counterparty_type = Column(
        String(50),
        nullable=True,
    )

    counterparty_identifier = Column(
        String(255),
        nullable=True,
    )

    counterparty_confidence = Column(
        Numeric(5, 4),
        nullable=True,
    )

    counterparty_source = Column(
        String(50),
        nullable=True,
    )

    counterparty_status = Column(
        String(50),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
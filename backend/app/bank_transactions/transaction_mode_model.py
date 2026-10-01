from sqlalchemy import Column, Integer, String
from app.core.database import Base

class TransactionMode(Base):
    __tablename__ = "transaction_mode"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    mode = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

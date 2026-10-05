from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class IOMaster(Base):
    __tablename__ = "io_master"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    officer_name = Column(
        String(150),
        nullable=False,
        index=True,
    )

    designation = Column(
        String(100),
        nullable=False,
        index=True,
    )

    police_station = Column(
        String(200),
        nullable=False,
        index=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
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

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    cases = relationship("Case", back_populates="io")

    @property
    def assigned_user_name(self) -> str | None:
        return self.creator.username if self.creator else None

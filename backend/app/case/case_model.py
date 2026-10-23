from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Case(Base):
    __tablename__ = "cases"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    case_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    case_name = Column(
        String(255),
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="DRAFT",
        index=True,
    )

    # User who created this case record
    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # User/Investigator to whom this case is assigned
    assigned_to = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Investigating Officer assigned to this case
    io_id = Column(
        Integer,
        ForeignKey("io_master.id"),
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

    # Relationships
    io = relationship("IOMaster", back_populates="cases")
    client = relationship("Client", back_populates="cases")
    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to])

    @property
    def owner_username(self) -> str | None:
        return self.creator.username if self.creator else None

    @property
    def owner_email(self) -> str | None:
        return self.creator.email if self.creator else None

    @property
    def owner_client_id(self) -> int | None:
        return self.creator.client_id if self.creator else None

    @property
    def owner_client_name(self) -> str | None:
        if self.creator and self.creator.client:
            return self.creator.client.name
        return None

    @property
    def owner_company_code(self) -> str | None:
        if self.creator and self.creator.client:
            return self.creator.client.company_code
        return None

    @property
    def owner_client(self):
        return self.creator.client if self.creator else None

    @property
    def client_name(self) -> str | None:
        if self.client:
            return self.client.name
        return None

    @property
    def company_code(self) -> str | None:
        if self.client:
            return self.client.company_code
        return None


# Register related models with SQLAlchemy mapper
import app.io_master.io_master_model  # noqa: E402, F401
import app.client.client_model  # noqa: E402, F401
import app.user.user_model  # noqa: E402, F401
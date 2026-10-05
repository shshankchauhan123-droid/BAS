from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserPermission(Base):
    __tablename__ = "user_permissions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # CASE
    can_view_cases: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    can_create_case: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # FILES
    can_upload_files: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    can_delete_files: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # REPORTS
    can_view_reports: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # IO
    can_view_io: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    can_create_io: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    can_update_io: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    can_delete_io: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="permissions",
    )
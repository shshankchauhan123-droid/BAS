"""add created_by to cases

Revision ID: 4e8bfceff93e
Revises: b273727765bd
Create Date: 2026-09-22 01:00:10.305922

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4e8bfceff93e"
down_revision: Union[str, Sequence[str], None] = "b273727765bd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the column temporarily as nullable
    op.add_column(
        "cases",
        sa.Column(
            "created_by",
            sa.Integer(),
            nullable=True,
        ),
    )

    # 2. Assign existing cases to the first user
    op.execute(
        """
        UPDATE cases
        SET created_by = (
            SELECT id
            FROM users
            ORDER BY id
            LIMIT 1
        )
        WHERE created_by IS NULL
        """
    )

    # 3. Make the column NOT NULL
    op.alter_column(
        "cases",
        "created_by",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # 4. Add foreign key
    op.create_foreign_key(
        "fk_cases_created_by_users",
        "cases",
        "users",
        ["created_by"],
        ["id"],
    )

    # 5. Add index
    op.create_index(
        "ix_cases_created_by",
        "cases",
        ["created_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_cases_created_by",
        table_name="cases",
    )

    op.drop_constraint(
        "fk_cases_created_by_users",
        "cases",
        type_="foreignkey",
    )

    op.drop_column(
        "cases",
        "created_by",
    )
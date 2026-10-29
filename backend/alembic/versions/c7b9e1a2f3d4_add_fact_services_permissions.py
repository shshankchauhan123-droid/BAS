"""add_fact_services_permissions

Revision ID: c7b9e1a2f3d4
Revises: e4c8b2a19f07
Create Date: 2026-10-28 15:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7b9e1a2f3d4'
down_revision: Union[str, Sequence[str], None] = 'e4c8b2a19f07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_permissions',
        sa.Column('can_gst_advance_search', sa.Boolean(), server_default='false', nullable=False)
    )
    op.add_column(
        'user_permissions',
        sa.Column('can_cin_advance_search', sa.Boolean(), server_default='false', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('user_permissions', 'can_cin_advance_search')
    op.drop_column('user_permissions', 'can_gst_advance_search')

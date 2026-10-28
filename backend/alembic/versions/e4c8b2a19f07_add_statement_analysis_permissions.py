"""add_statement_analysis_permissions

Revision ID: e4c8b2a19f07
Revises: f1b98a3c2e74
Create Date: 2026-10-27 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4c8b2a19f07'
down_revision: Union[str, Sequence[str], None] = 'f1b98a3c2e74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_permissions',
        sa.Column('can_bank_statement_analysis', sa.Boolean(), server_default='false', nullable=False)
    )
    op.add_column(
        'user_permissions',
        sa.Column('can_ncrp_statement_analysis', sa.Boolean(), server_default='false', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('user_permissions', 'can_ncrp_statement_analysis')
    op.drop_column('user_permissions', 'can_bank_statement_analysis')

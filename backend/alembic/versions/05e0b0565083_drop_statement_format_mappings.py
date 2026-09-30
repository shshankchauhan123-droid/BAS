"""Drop statement format mappings

Revision ID: 05e0b0565083
Revises: 5fe1c25fd22e
Create Date: 2026-09-29 12:24:11.641414

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05e0b0565083'
down_revision: Union[str, Sequence[str], None] = '5fe1c25fd22e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_table('statement_format_mappings')


def downgrade() -> None:
    """Downgrade schema."""
    pass

"""add_attachment_columns_to_support_tickets

Revision ID: f6e9b3a4c5d8
Revises: e5d8a2b3c4f7
Create Date: 2026-11-04 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6e9b3a4c5d8'
down_revision: Union[str, Sequence[str], None] = 'e5d8a2b3c4f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('support_tickets', sa.Column('attachment_filename', sa.String(length=255), nullable=True))
    op.add_column('support_tickets', sa.Column('attachment_path', sa.String(length=500), nullable=True))
    op.add_column('support_tickets', sa.Column('attachment_mime', sa.String(length=100), nullable=True))
    op.add_column('support_tickets', sa.Column('attachment_size', sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('support_tickets', 'attachment_size')
    op.drop_column('support_tickets', 'attachment_mime')
    op.drop_column('support_tickets', 'attachment_path')
    op.drop_column('support_tickets', 'attachment_filename')

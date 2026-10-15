"""Add superseded status to files

Revision ID: c8940e2f5b61
Revises: b783f91a2c34
Create Date: 2026-10-15 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8940e2f5b61'
down_revision: Union[str, Sequence[str], None] = 'b783f91a2c34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_superseded column to files table
    op.add_column('files', sa.Column('is_superseded', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.create_index(op.f('ix_files_is_superseded'), 'files', ['is_superseded'], unique=False)

    # 2. Add superseded_by_file_id column to files table
    op.add_column('files', sa.Column('superseded_by_file_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_files_superseded_by_file_id', 'files', 'files', ['superseded_by_file_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_files_superseded_by_file_id'), 'files', ['superseded_by_file_id'], unique=False)

    # 3. Backfill any existing merged file sources so that source files are marked superseded
    op.execute("""
        UPDATE files f
        SET is_superseded = TRUE, superseded_by_file_id = mfs.merged_file_id
        FROM merged_file_sources mfs
        WHERE f.id = mfs.source_file_id
    """)


def downgrade() -> None:
    op.drop_constraint('fk_files_superseded_by_file_id', 'files', type_='foreignkey')
    op.drop_index(op.f('ix_files_superseded_by_file_id'), table_name='files')
    op.drop_column('files', 'superseded_by_file_id')

    op.drop_index(op.f('ix_files_is_superseded'), table_name='files')
    op.drop_column('files', 'is_superseded')

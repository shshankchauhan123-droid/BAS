"""Add merged bank statement support

Revision ID: b783f91a2c34
Revises: 00d93c533932
Create Date: 2026-10-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b783f91a2c34'
down_revision: Union[str, Sequence[str], None] = '00d93c533932'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_merged column to files table
    op.add_column('files', sa.Column('is_merged', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.create_index(op.f('ix_files_is_merged'), 'files', ['is_merged'], unique=False)

    # 2. Create merged_file_sources junction table
    op.create_table(
        'merged_file_sources',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('merged_file_id', sa.Integer(), nullable=False),
        sa.Column('source_file_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['merged_file_id'], ['files.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_file_id'], ['files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('merged_file_id', 'source_file_id', name='uq_merged_file_source')
    )
    op.create_index(op.f('ix_merged_file_sources_id'), 'merged_file_sources', ['id'], unique=False)
    op.create_index(op.f('ix_merged_file_sources_merged_file_id'), 'merged_file_sources', ['merged_file_id'], unique=False)
    op.create_index(op.f('ix_merged_file_sources_source_file_id'), 'merged_file_sources', ['source_file_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_merged_file_sources_source_file_id'), table_name='merged_file_sources')
    op.drop_index(op.f('ix_merged_file_sources_merged_file_id'), table_name='merged_file_sources')
    op.drop_index(op.f('ix_merged_file_sources_id'), table_name='merged_file_sources')
    op.drop_table('merged_file_sources')

    op.drop_index(op.f('ix_files_is_merged'), table_name='files')
    op.drop_column('files', 'is_merged')

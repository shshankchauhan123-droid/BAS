"""add_document_type_to_files

Revision ID: d31996f27b37
Revises: c8940e2f5b61
Create Date: 2026-10-24 17:27:47.769364

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd31996f27b37'
down_revision: Union[str, Sequence[str], None] = 'c8940e2f5b61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add document_type column as nullable initially
    op.add_column('files', sa.Column('document_type', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_files_document_type'), 'files', ['document_type'], unique=False)

    # 2. Backfill existing verified bank statement files
    op.execute("""
        UPDATE files
        SET document_type = 'BANK_STATEMENT'
        WHERE id IN (SELECT DISTINCT file_id FROM bank_transactions)
           OR account_number IS NOT NULL
           OR bank_name IS NOT NULL
           OR is_merged = true
           OR id IN (SELECT DISTINCT source_file_id FROM merged_file_sources)
    """)

    # 3. Mark unverified / unresolved historical files as UNKNOWN
    op.execute("""
        UPDATE files
        SET document_type = 'UNKNOWN'
        WHERE document_type IS NULL
    """)

    # 4. Enforce NOT NULL and set server_default
    op.alter_column(
        'files',
        'document_type',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default=sa.text("'BANK_STATEMENT'")
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_files_document_type'), table_name='files')
    op.drop_column('files', 'document_type')

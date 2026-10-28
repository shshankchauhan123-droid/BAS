"""create_ncrp_tables

Revision ID: f1b98a3c2e74
Revises: d31996f27b37
Create Date: 2026-10-26 02:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f1b98a3c2e74'
down_revision: Union[str, Sequence[str], None] = 'd31996f27b37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create ncrp_file table
    op.create_table(
        'ncrp_file',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('stored_filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='PROCESSING', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sheet_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_rows', sa.Integer(), server_default='0', nullable=False),
        sa.Column('imported_rows', sa.Integer(), server_default='0', nullable=False),
        sa.Column('failed_rows', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ncrp_file_id'), 'ncrp_file', ['id'], unique=False)
    op.create_index(op.f('ix_ncrp_file_case_id'), 'ncrp_file', ['case_id'], unique=False)
    op.create_index(op.f('ix_ncrp_file_created_by'), 'ncrp_file', ['created_by'], unique=False)
    op.create_index(op.f('ix_ncrp_file_status'), 'ncrp_file', ['status'], unique=False)

    # 2. Create ncrp_transactions table
    json_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql')

    op.create_table(
        'ncrp_transactions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ncrp_file_id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('sheet_name', sa.String(length=255), nullable=False),
        sa.Column('row_number', sa.Integer(), nullable=False),
        sa.Column('acknowledgement_no', sa.String(length=100), nullable=True),
        sa.Column('account_or_wallet_id', sa.String(length=255), nullable=True),
        sa.Column('transaction_id_utr', sa.String(length=255), nullable=True),
        sa.Column('transaction_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('transaction_amount', sa.Numeric(precision=20, scale=2), nullable=True),
        sa.Column('disputed_amount', sa.Numeric(precision=20, scale=2), nullable=True),
        sa.Column('bank_name', sa.String(length=255), nullable=True),
        sa.Column('layer', sa.String(length=100), nullable=True),
        sa.Column('raw_data', json_type, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ncrp_file_id'], ['ncrp_file.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ncrp_transactions_id'), 'ncrp_transactions', ['id'], unique=False)
    op.create_index(op.f('ix_ncrp_transactions_ncrp_file_id'), 'ncrp_transactions', ['ncrp_file_id'], unique=False)
    op.create_index(op.f('ix_ncrp_transactions_case_id'), 'ncrp_transactions', ['case_id'], unique=False)
    op.create_index(op.f('ix_ncrp_transactions_sheet_name'), 'ncrp_transactions', ['sheet_name'], unique=False)
    op.create_index(op.f('ix_ncrp_transactions_acknowledgement_no'), 'ncrp_transactions', ['acknowledgement_no'], unique=False)
    op.create_index(op.f('ix_ncrp_transactions_transaction_id_utr'), 'ncrp_transactions', ['transaction_id_utr'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ncrp_transactions_transaction_id_utr'), table_name='ncrp_transactions')
    op.drop_index(op.f('ix_ncrp_transactions_acknowledgement_no'), table_name='ncrp_transactions')
    op.drop_index(op.f('ix_ncrp_transactions_sheet_name'), table_name='ncrp_transactions')
    op.drop_index(op.f('ix_ncrp_transactions_case_id'), table_name='ncrp_transactions')
    op.drop_index(op.f('ix_ncrp_transactions_ncrp_file_id'), table_name='ncrp_transactions')
    op.drop_index(op.f('ix_ncrp_transactions_id'), table_name='ncrp_transactions')
    op.drop_table('ncrp_transactions')

    op.drop_index(op.f('ix_ncrp_file_status'), table_name='ncrp_file')
    op.drop_index(op.f('ix_ncrp_file_created_by'), table_name='ncrp_file')
    op.drop_index(op.f('ix_ncrp_file_case_id'), table_name='ncrp_file')
    op.drop_index(op.f('ix_ncrp_file_id'), table_name='ncrp_file')
    op.drop_table('ncrp_file')

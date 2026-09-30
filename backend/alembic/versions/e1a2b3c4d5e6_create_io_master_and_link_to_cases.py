"""create io_master and link to cases

Revision ID: e1a2b3c4d5e6
Revises: 5fe1c25fd22e
Create Date: 2026-09-29 12:54:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '5fe1c25fd22e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create io_master table
    op.create_table(
        'io_master',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('officer_name', sa.String(length=150), nullable=False),
        sa.Column('designation', sa.String(length=100), nullable=False),
        sa.Column('police_station', sa.String(length=200), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_io_master_id'), 'io_master', ['id'], unique=False)
    op.create_index(op.f('ix_io_master_officer_name'), 'io_master', ['officer_name'], unique=False)
    op.create_index(op.f('ix_io_master_designation'), 'io_master', ['designation'], unique=False)
    op.create_index(op.f('ix_io_master_police_station'), 'io_master', ['police_station'], unique=False)
    op.create_index(op.f('ix_io_master_created_by'), 'io_master', ['created_by'], unique=False)

    # 2. Add io_id to cases table
    op.add_column('cases', sa.Column('io_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_cases_io_id_io_master', 'cases', 'io_master', ['io_id'], ['id'])
    op.create_index(op.f('ix_cases_io_id'), 'cases', ['io_id'], unique=False)


def downgrade() -> None:
    # 1. Remove io_id from cases table
    op.drop_index(op.f('ix_cases_io_id'), table_name='cases')
    op.drop_constraint('fk_cases_io_id_io_master', 'cases', type_='foreignkey')
    op.drop_column('cases', 'io_id')

    # 2. Drop io_master table
    op.drop_index(op.f('ix_io_master_created_by'), table_name='io_master')
    op.drop_index(op.f('ix_io_master_police_station'), table_name='io_master')
    op.drop_index(op.f('ix_io_master_designation'), table_name='io_master')
    op.drop_index(op.f('ix_io_master_officer_name'), table_name='io_master')
    op.drop_index(op.f('ix_io_master_id'), table_name='io_master')
    op.drop_table('io_master')

"""create_support_tickets_tables

Revision ID: e5d8a2b3c4f7
Revises: c7b9e1a2f3d4
Create Date: 2026-11-04 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5d8a2b3c4f7'
down_revision: Union[str, Sequence[str], None] = 'c7b9e1a2f3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create support_tickets table
    op.create_table(
        'support_tickets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ticket_number', sa.String(length=50), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=20), server_default='medium', nullable=False),
        sa.Column('related_module', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='open', nullable=False),
        sa.Column('assigned_admin_id', sa.Integer(), nullable=True),
        sa.Column('admin_response', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_number'),
    )
    op.create_index(op.f('ix_support_tickets_id'), 'support_tickets', ['id'], unique=False)
    op.create_index(op.f('ix_support_tickets_ticket_number'), 'support_tickets', ['ticket_number'], unique=True)
    op.create_index(op.f('ix_support_tickets_client_id'), 'support_tickets', ['client_id'], unique=False)
    op.create_index(op.f('ix_support_tickets_user_id'), 'support_tickets', ['user_id'], unique=False)
    op.create_index(op.f('ix_support_tickets_priority'), 'support_tickets', ['priority'], unique=False)
    op.create_index(op.f('ix_support_tickets_status'), 'support_tickets', ['status'], unique=False)
    op.create_index(op.f('ix_support_tickets_assigned_admin_id'), 'support_tickets', ['assigned_admin_id'], unique=False)
    op.create_index(op.f('ix_support_tickets_created_at'), 'support_tickets', ['created_at'], unique=False)
    op.create_index(op.f('ix_support_tickets_updated_at'), 'support_tickets', ['updated_at'], unique=False)
    op.create_index('ix_support_tickets_client_status', 'support_tickets', ['client_id', 'status'], unique=False)
    op.create_index('ix_support_tickets_user_status', 'support_tickets', ['user_id', 'status'], unique=False)

    # 2. Create ticket_activities table
    op.create_table(
        'ticket_activities',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ticket_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=True),
        sa.Column('author_role', sa.String(length=50), nullable=False),
        sa.Column('author_name', sa.String(length=100), nullable=True),
        sa.Column('activity_type', sa.String(length=50), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_internal', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['support_tickets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ticket_activities_id'), 'ticket_activities', ['id'], unique=False)
    op.create_index(op.f('ix_ticket_activities_ticket_id'), 'ticket_activities', ['ticket_id'], unique=False)
    op.create_index(op.f('ix_ticket_activities_author_id'), 'ticket_activities', ['author_id'], unique=False)
    op.create_index(op.f('ix_ticket_activities_is_internal'), 'ticket_activities', ['is_internal'], unique=False)
    op.create_index(op.f('ix_ticket_activities_created_at'), 'ticket_activities', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('ticket_activities')
    op.drop_table('support_tickets')

"""structure gap forecast tables

Revision ID: f7a3c9e21b84
Revises: e5b2a8f31c47
Create Date: 2026-10-07 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

from app.models.types import UTCDateTime


revision = 'f7a3c9e21b84'
down_revision = 'e5b2a8f31c47'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'sequence_level_headcounts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=False),
        sa.Column('sequence', sa.String(length=32), nullable=False),
        sa.Column('level_order', sa.Integer(), nullable=False),
        sa.Column('headcount', sa.Integer(), nullable=False),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', UTCDateTime(), nullable=False),
        sa.Column('updated_at', UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'tenant_id', 'sequence', 'level_order',
            name='seq_level_headcounts_tenant_seq_level_uc',
        ),
    )
    op.create_index(
        op.f('ix_sequence_level_headcounts_tenant_id'),
        'sequence_level_headcounts', ['tenant_id'],
    )
    op.create_table(
        'structure_gap_configs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=False),
        sa.Column('factor_l1', sa.Float(), nullable=False),
        sa.Column('factor_l2', sa.Float(), nullable=False),
        sa.Column('factor_l3', sa.Float(), nullable=False),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', UTCDateTime(), nullable=False),
        sa.Column('updated_at', UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_structure_gap_configs_tenant'),
    )
    op.create_index(
        op.f('ix_structure_gap_configs_tenant_id'),
        'structure_gap_configs', ['tenant_id'], unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_structure_gap_configs_tenant_id'),
        table_name='structure_gap_configs',
    )
    op.drop_table('structure_gap_configs')
    op.drop_index(
        op.f('ix_sequence_level_headcounts_tenant_id'),
        table_name='sequence_level_headcounts',
    )
    op.drop_table('sequence_level_headcounts')

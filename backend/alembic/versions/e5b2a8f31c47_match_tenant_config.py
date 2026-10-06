"""match tenant config

Revision ID: e5b2a8f31c47
Revises: 776893e567e2
Create Date: 2026-10-06 10:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

from app.models.types import UTCDateTime


revision = 'e5b2a8f31c47'
down_revision = '776893e567e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'match_tenant_configs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=False),
        sa.Column('weights', sa.JSON(), nullable=False),
        sa.Column('required', sa.JSON(), nullable=False),
        sa.Column('good_threshold', sa.Integer(), nullable=False),
        sa.Column('warn_threshold', sa.Integer(), nullable=False),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', UTCDateTime(), nullable=False),
        sa.Column('updated_at', UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_match_tenant_configs_tenant'),
    )
    op.create_index(
        op.f('ix_match_tenant_configs_tenant_id'),
        'match_tenant_configs', ['tenant_id'], unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_match_tenant_configs_tenant_id'),
        table_name='match_tenant_configs',
    )
    op.drop_table('match_tenant_configs')

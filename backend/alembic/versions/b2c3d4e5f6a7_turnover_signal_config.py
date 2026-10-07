"""turnover_signal_configs (P3 离职风险信号配置)

Revision ID: b2c3d4e5f6a7
Revises: f1a2b3c4d5e6
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa


revision = "b2c3d4e5f6a7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "turnover_signal_configs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("thresholds", sa.JSON(), nullable=True),
        sa.Column("weights", sa.JSON(), nullable=True),
        sa.Column("buckets", sa.JSON(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_turnover_signal_configs_tenant",
        "turnover_signal_configs",
        ["tenant_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_turnover_signal_configs_tenant", table_name="turnover_signal_configs")
    op.drop_table("turnover_signal_configs")

"""perf_standards_library

Revision ID: b9d3e5f1a2c4
Revises: a8c4f2e7b910
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa


revision = "b9d3e5f1a2c4"
down_revision = "a8c4f2e7b910"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "perf_indicators",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("sequence_codes", sa.JSON(), nullable=False),
        sa.Column("weight_min", sa.Float(), nullable=True),
        sa.Column("weight_max", sa.Float(), nullable=True),
        sa.Column("data_source", sa.String(length=128), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_perf_indicators_tenant_id", "perf_indicators", ["tenant_id"]
    )
    op.create_index(
        "ix_perf_indicators_type", "perf_indicators", ["type"]
    )


def downgrade() -> None:
    op.drop_index("ix_perf_indicators_type", table_name="perf_indicators")
    op.drop_index("ix_perf_indicators_tenant_id", table_name="perf_indicators")
    op.drop_table("perf_indicators")

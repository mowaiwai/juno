"""platform_operations

Revision ID: e9f3a6b8c4d1
Revises: d8a2b5c7e1f3
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa


revision = "e9f3a6b8c4d1"
down_revision = "d8a2b5c7e1f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # tenants 表扩展平台运营字段
    op.add_column("tenants", sa.Column("status", sa.String(length=16), nullable=False, server_default="active"))
    op.add_column("tenants", sa.Column("industry", sa.String(length=32), nullable=True))
    op.add_column("tenants", sa.Column("plan_name", sa.String(length=32), nullable=True))
    op.add_column("tenants", sa.Column("seats", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("tenants", sa.Column("mrr", sa.Float(), nullable=False, server_default="0"))
    op.add_column("tenants", sa.Column("health", sa.Integer(), nullable=False, server_default="100"))
    op.add_column("tenants", sa.Column("joined_at", sa.String(length=10), nullable=True))
    op.create_index("ix_tenants_status", "tenants", ["status"])

    # 平台月度指标快照
    op.create_table(
        "platform_monthly_metrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("mrr", sa.Float(), nullable=False, server_default="0"),
        sa.Column("new_tenants", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("month"),
    )

    # 月度指标种子（近 6 个月，单位：元）
    op.execute("""
        INSERT INTO platform_monthly_metrics (id, month, mrr, new_tenants, created_at, updated_at)
        VALUES
          (gen_random_uuid(), '2026-04', 426000, 7, now(), now()),
          (gen_random_uuid(), '2026-05', 482000, 9, now(), now()),
          (gen_random_uuid(), '2026-06', 538000, 8, now(), now()),
          (gen_random_uuid(), '2026-07', 591000, 10, now(), now()),
          (gen_random_uuid(), '2026-08', 643000, 11, now(), now()),
          (gen_random_uuid(), '2026-09', 682000, 11, now(), now())
    """)


def downgrade() -> None:
    op.drop_table("platform_monthly_metrics")
    op.drop_index("ix_tenants_status", table_name="tenants")
    op.drop_column("tenants", "joined_at")
    op.drop_column("tenants", "health")
    op.drop_column("tenants", "mrr")
    op.drop_column("tenants", "seats")
    op.drop_column("tenants", "plan_name")
    op.drop_column("tenants", "industry")
    op.drop_column("tenants", "status")

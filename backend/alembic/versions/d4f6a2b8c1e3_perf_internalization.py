"""P1 绩效内生：perf_plans / perf_results / pips / coaching_records

Revision ID: d4f6a2b8c1e3
Revises: a1b2c3d4e5f6
Create Date: 2026-07-01

变更（ADR-0015 P1 / ADR-0016）：
1. perf_plans 考核方案（周期/工具/显式名册 JSON/状态机/分布覆盖理由）。
2. perf_results 周期 SABC 结果（分数/绩效系数/org 系数预留/举证），
   (plan_id, employee_id) 唯一。
3. pips 绩效改进计划（D 自动建档；结论终结；linked_adjust_id 为 P2 空钩子）。
4. coaching_records 轻量辅导记录。
枚举均以小写字符串存储，不建 PG 原生枚举，避免枚举漂移。
"""
import sqlalchemy as sa
from alembic import op

from app.models.types import UTCDateTime

revision = "d4f6a2b8c1e3"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "perf_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("period", sa.String(length=20), nullable=False),
        sa.Column("tool_type", sa.String(length=8), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("roster", sa.JSON(), nullable=False),
        sa.Column("scope_depts", sa.JSON(), nullable=False),
        sa.Column("scope_sequences", sa.JSON(), nullable=False),
        sa.Column("distribution_override_reason", sa.Text(), nullable=True),
        sa.Column("published_at", UTCDateTime(), nullable=True),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_perf_plans_tenant_id", "perf_plans", ["tenant_id"])

    op.create_table(
        "perf_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("grade", sa.String(length=2), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("coefficient", sa.Float(), nullable=False),
        sa.Column(
            "org_coefficient",
            sa.Float(),
            nullable=False,
            server_default="1.0",
        ),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("entered_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["plan_id"], ["perf_plans.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["entered_by"], ["users.id"]),
        sa.UniqueConstraint(
            "plan_id", "employee_id", name="uq_perf_result_plan_employee"
        ),
    )
    op.create_index("ix_perf_results_tenant_id", "perf_results", ["tenant_id"])
    op.create_index("ix_perf_results_plan_id", "perf_results", ["plan_id"])
    op.create_index(
        "ix_perf_results_employee_id", "perf_results", ["employee_id"]
    )

    op.create_table(
        "pips",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("perf_result_id", sa.Uuid(), nullable=True),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("period", sa.String(length=20), nullable=False),
        sa.Column("goals", sa.JSON(), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="active",
        ),
        sa.Column("conclusion", sa.Text(), nullable=True),
        sa.Column("concluded_by", sa.Uuid(), nullable=True),
        sa.Column("concluded_at", UTCDateTime(), nullable=True),
        sa.Column("linked_adjust_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["perf_result_id"], ["perf_results.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
    )
    op.create_index("ix_pips_tenant_id", "pips", ["tenant_id"])
    op.create_index("ix_pips_perf_result_id", "pips", ["perf_result_id"])
    op.create_index("ix_pips_employee_id", "pips", ["employee_id"])

    op.create_table(
        "coaching_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("happened_at", sa.Date(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["plan_id"], ["perf_plans.id"]),
    )
    op.create_index(
        "ix_coaching_records_tenant_id", "coaching_records", ["tenant_id"]
    )
    op.create_index(
        "ix_coaching_records_employee_id",
        "coaching_records",
        ["employee_id"],
    )
    op.create_index(
        "ix_coaching_records_plan_id", "coaching_records", ["plan_id"]
    )


def downgrade() -> None:
    op.drop_table("coaching_records")
    op.drop_table("pips")
    op.drop_table("perf_results")
    op.drop_table("perf_plans")

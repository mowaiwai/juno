"""job_evaluation + benefits + questionnaire (P3 远期能力)

Revision ID: f1a2b3c4d5e6
Revises: e9f3a6b8c4d1
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "e9f3a6b8c4d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 岗位价值评估
    op.create_table(
        "job_evaluations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("position_name", sa.String(length=128), nullable=False),
        sa.Column("dept_id", sa.String(length=32), nullable=True),
        sa.Column("factor_scores", sa.JSON(), nullable=True),
        sa.Column("total_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("grade", sa.String(length=16), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("evaluated_by", sa.Uuid(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_evaluations_tenant", "job_evaluations", ["tenant_id"])

    # 津贴福利/股权/荣誉（统一激励记录表）
    op.create_table(
        "incentive_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        # benefit 津贴福利 / equity 股权 / honor 荣誉表彰
        sa.Column("category", sa.String(length=16), nullable=False),
        sa.Column("item_name", sa.String(length=128), nullable=False),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("granted_at", sa.Date(), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_incentive_records_tenant", "incentive_records", ["tenant_id"])
    op.create_index("ix_incentive_records_employee", "incentive_records", ["employee_id"])
    op.create_index("ix_incentive_records_category", "incentive_records", ["category"])

    # 问卷（盘点/测评问卷，AI 生成）
    op.create_table(
        "questionnaires",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        # inventory 盘点问卷 / competency 能力测评 / engagement 敬业度
        sa.Column("q_type", sa.String(length=16), nullable=False),
        # 题目列表：[{"text":"...","dimension":"...","level":1,"options":[...]}]
        sa.Column("questions", sa.JSON(), nullable=True),
        sa.Column("source", sa.String(length=16), nullable=False, server_default="ai_generated"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_questionnaires_tenant", "questionnaires", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("questionnaires")
    op.drop_table("incentive_records")
    op.drop_table("job_evaluations")

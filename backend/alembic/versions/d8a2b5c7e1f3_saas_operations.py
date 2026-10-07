"""saas_operations

Revision ID: d8a2b5c7e1f3
Revises: c7e1f4a9b3d5
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa


revision = "d8a2b5c7e1f3"
down_revision = "c7e1f4a9b3d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "billing_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False, server_default=""),
        sa.Column("billing", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("price", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "billing_bills",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("plan_name", sa.String(length=32), nullable=False),
        sa.Column("seats", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("seat_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("ai_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_billing_bills_tenant_id", "billing_bills", ["tenant_id"])

    op.create_table(
        "template_packs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("industry", sa.String(length=32), nullable=False),
        sa.Column("version", sa.String(length=16), nullable=False),
        sa.Column("standards_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rating", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("installs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=8), nullable=False, server_default="on"),
        sa.Column("desc", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "tenant_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("pack_id", sa.Uuid(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tenant_templates_tenant_id", "tenant_templates", ["tenant_id"])
    op.create_index("ix_tenant_templates_pack_id", "tenant_templates", ["pack_id"])

    op.create_table(
        "saas_config_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("group", sa.String(length=64), nullable=False),
        sa.Column("template_value", sa.Text(), nullable=False, server_default=""),
        sa.Column("override_value", sa.Text(), nullable=False, server_default=""),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saas_config_items_tenant_id", "saas_config_items", ["tenant_id"])

    # ai_usage 扩展：cost + operator
    op.add_column("ai_usage", sa.Column("cost", sa.Float(), nullable=False, server_default="0"))
    op.add_column("ai_usage", sa.Column("operator", sa.String(length=128), nullable=True))

    # 平台套餐目录种子
    op.execute("""
        INSERT INTO billing_plans (id, name, scope, billing, price, sort_order, created_at, updated_at)
        VALUES
          (gen_random_uuid(), '免费试用', '画像 + 基础盘点', '限额内免费', '¥0', 0, now(), now()),
          (gen_random_uuid(), '标准版', '任职资格 + 绩效 + 十大应用', '按员工席位订阅', '¥69 / 席位·月', 1, now(), now()),
          (gen_random_uuid(), '专业版', 'AI 能力 + 高级报表/驾驶舱', '席位 + AI 用量', '¥129 / 席位·月', 2, now(), now()),
          (gen_random_uuid(), '企业版', '独立实例/私有化、SSO、定制', '年度合同 + 实施费', '洽谈', 3, now(), now())
    """)

    # 模板市场种子
    op.execute("""
        INSERT INTO template_packs (id, name, industry, version, standards_count, rating, installs, status, "desc", created_at, updated_at)
        VALUES
          (gen_random_uuid(), '制造行业任职资格包', '制造', 'v2.1', 86, 4.9, 1240, 'on', '覆盖研发/工艺/操作/职能全序列，含带宽与调薪规则建议值', now(), now()),
          (gen_random_uuid(), '高新科技（软硬件）包', '科技', 'v2.0', 74, 4.8, 860, 'on', 'P/T 双族细分，适配研发驱动型组织', now(), now()),
          (gen_random_uuid(), '零售连锁运营包', '零售', 'v1.6', 52, 4.6, 540, 'on', '门店运营、采购与督导序列，含排班绩效规则', now(), now()),
          (gen_random_uuid(), '大宗贸易业务包', '大宗贸易', 'v1.4', 46, 4.5, 320, 'on', '业务/风控/物流三族，适配贸易型企业', now(), now()),
          (gen_random_uuid(), '通用职能基础包', '通用', 'v3.0', 38, 4.7, 1580, 'on', 'HR/财务/行政职能序列，可与任意行业包叠加', now(), now())
    """)


def downgrade() -> None:
    op.drop_column("ai_usage", "operator")
    op.drop_column("ai_usage", "cost")
    op.drop_index("ix_saas_config_items_tenant_id", table_name="saas_config_items")
    op.drop_table("saas_config_items")
    op.drop_index("ix_tenant_templates_pack_id", table_name="tenant_templates")
    op.drop_index("ix_tenant_templates_tenant_id", table_name="tenant_templates")
    op.drop_table("tenant_templates")
    op.drop_table("template_packs")
    op.drop_index("ix_billing_bills_tenant_id", table_name="billing_bills")
    op.drop_table("billing_bills")
    op.drop_table("billing_plans")

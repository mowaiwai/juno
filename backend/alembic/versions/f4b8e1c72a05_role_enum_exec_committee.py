"""role 枚举扩展：EXECUTIVE / COMMITTEE

Revision ID: f4b8e1c72a05
Revises: a3f7c2d91e04
Create Date: 2026-10-01

ADR-0012 八角色对齐：PG 原生枚举 role 增补 EXECUTIVE、COMMITTEE 两个取值。
PG ≥12 支持事务内 ALTER TYPE ... ADD VALUE（同一事务内不消费新值即可）。
"""
from alembic import op

revision = 'f4b8e1c72a05'
down_revision = 'a3f7c2d91e04'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'EXECUTIVE'")
    op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'COMMITTEE'")


def downgrade() -> None:
    # PG 不支持删除枚举值；如需回滚须重建枚举类型，留空有意为之。
    pass

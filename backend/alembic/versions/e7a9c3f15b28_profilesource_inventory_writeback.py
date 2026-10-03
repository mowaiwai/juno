"""profilesource 枚举扩展：INVENTORY_WRITEBACK

Revision ID: e7a9c3f15b28
Revises: f4b8e1c72a05
Create Date: 2026-10-01

盘点发布回写画像（数据飞轮）：PG 原生枚举 profilesource 增补 INVENTORY_WRITEBACK。
PG ≥12 支持事务内 ALTER TYPE ... ADD VALUE（同一事务内不消费新值即可）。
"""
from alembic import op

revision = 'e7a9c3f15b28'
down_revision = 'f4b8e1c72a05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE profilesource ADD VALUE IF NOT EXISTS 'INVENTORY_WRITEBACK'")


def downgrade() -> None:
    # PG 不支持删除枚举值；如需回滚须重建枚举类型，留空有意为之。
    pass

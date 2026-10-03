"""users.roles 多角色支持

Revision ID: a3f7c2d91e04
Revises: 841474803e36
Create Date: 2026-10-01

users 表新增 roles JSON 数组（全量角色集），回填为 [role]；保留 role 列作为主角色。
"""
import sqlalchemy as sa
from alembic import op

revision = 'a3f7c2d91e04'
down_revision = '841474803e36'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('roles', sa.JSON(), nullable=True),
    )
    # 回填：roles = [主角色]
    op.execute("UPDATE users SET roles = json_build_array(role::text)")
    op.alter_column('users', 'roles', nullable=False)


def downgrade() -> None:
    op.drop_column('users', 'roles')

"""recruit_p3_enhance: 五维题库+评分锚点+预匹配

Revision ID: a8c4f2e7b910
Revises: f7a3c9e21b84
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa


revision = 'a8c4f2e7b910'
down_revision = 'f7a3c9e21b84'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # interview_questions: dimension_key / sequence / rubric
    op.add_column('interview_questions',
                  sa.Column('dimension_key', sa.String(length=32), nullable=False, server_default=''))
    op.add_column('interview_questions',
                  sa.Column('sequence', sa.String(length=32), nullable=False, server_default=''))
    op.add_column('interview_questions',
                  sa.Column('rubric', sa.JSON(), nullable=False, server_default='[]'))
    # candidates: prescreen_score
    op.add_column('candidates',
                  sa.Column('prescreen_score', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('candidates', 'prescreen_score')
    op.drop_column('interview_questions', 'rubric')
    op.drop_column('interview_questions', 'sequence')
    op.drop_column('interview_questions', 'dimension_key')

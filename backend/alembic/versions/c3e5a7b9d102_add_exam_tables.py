"""add exam tables (papers/questions/attempts)

Revision ID: c3e5a7b9d102
Revises: e7a9c3f15b28
Create Date: 2026-10-03

在线考试：试卷（AI 组卷→审核→发布）、四选一单选题目、员工考试记录。
状态/题型用 String 列存储，避免 PG 枚举迁移负担。
"""
from alembic import op
import sqlalchemy as sa

from app.models.types import UTCDateTime


revision = 'c3e5a7b9d102'
down_revision = 'e7a9c3f15b28'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'exam_papers',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=128), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('target_position', sa.String(length=128), nullable=False),
        sa.Column('target_sequence', sa.String(length=32), nullable=False),
        sa.Column('target_grade', sa.String(length=32), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('source', sa.String(length=8), nullable=False),
        sa.Column('model', sa.String(length=64), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('pass_score', sa.Integer(), nullable=False),
        sa.Column('total_score', sa.Integer(), nullable=False),
        sa.Column('reject_reason', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Uuid(), nullable=False),
        sa.Column('created_at', UTCDateTime(), nullable=False),
        sa.Column('published_at', UTCDateTime(), nullable=True),
        sa.Column('updated_at', UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_exam_papers_tenant_id'), 'exam_papers', ['tenant_id'])

    op.create_table(
        'exam_questions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('paper_id', sa.Uuid(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=16), nullable=False),
        sa.Column('stem', sa.Text(), nullable=False),
        sa.Column('options', sa.JSON(), nullable=False),
        sa.Column('answer_index', sa.Integer(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('analysis', sa.Text(), nullable=False),
        sa.Column('created_at', UTCDateTime(), nullable=False),
        sa.Column('updated_at', UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(['paper_id'], ['exam_papers.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_exam_questions_paper_id'), 'exam_questions', ['paper_id'])

    op.create_table(
        'exam_attempts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=False),
        sa.Column('paper_id', sa.Uuid(), nullable=False),
        sa.Column('examinee_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('answers', sa.JSON(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('total_score', sa.Integer(), nullable=False),
        sa.Column('passed', sa.Boolean(), nullable=False),
        sa.Column('started_at', UTCDateTime(), nullable=False),
        sa.Column('submitted_at', UTCDateTime(), nullable=True),
        sa.Column('created_at', UTCDateTime(), nullable=False),
        sa.Column('updated_at', UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(['paper_id'], ['exam_papers.id']),
        sa.ForeignKeyConstraint(['examinee_id'], ['employees.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_exam_attempts_tenant_id'), 'exam_attempts', ['tenant_id'])
    op.create_index(op.f('ix_exam_attempts_paper_id'), 'exam_attempts', ['paper_id'])
    op.create_index(op.f('ix_exam_attempts_examinee_id'), 'exam_attempts', ['examinee_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_exam_attempts_examinee_id'), table_name='exam_attempts')
    op.drop_index(op.f('ix_exam_attempts_paper_id'), table_name='exam_attempts')
    op.drop_index(op.f('ix_exam_attempts_tenant_id'), table_name='exam_attempts')
    op.drop_table('exam_attempts')

    op.drop_index(op.f('ix_exam_questions_paper_id'), table_name='exam_questions')
    op.drop_table('exam_questions')

    op.drop_index(op.f('ix_exam_papers_tenant_id'), table_name='exam_papers')
    op.drop_table('exam_papers')

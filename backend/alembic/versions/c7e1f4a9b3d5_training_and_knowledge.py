"""training_and_knowledge

Revision ID: c7e1f4a9b3d5
Revises: b9d3e5f1a2c4
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa


revision = "c7e1f4a9b3d5"
down_revision = "b9d3e5f1a2c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "training_courses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("instructor_name", sa.String(length=64), nullable=False),
        sa.Column("hours", sa.Float(), nullable=False, server_default="0"),
        sa.Column("enrolled", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="enrolling"),
        sa.Column("started_at", sa.String(length=10), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_training_courses_tenant_id", "training_courses", ["tenant_id"])
    op.create_index("ix_training_courses_type", "training_courses", ["type"])

    op.create_table(
        "training_instructors",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("field", sa.String(length=64), nullable=False),
        sa.Column("rating", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("internal", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_training_instructors_tenant_id", "training_instructors", ["tenant_id"])

    op.create_table(
        "knowledge_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("author", sa.String(length=64), nullable=False),
        sa.Column("way", sa.String(length=16), nullable=False, server_default="interview"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("reads", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("likes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_knowledge_items_tenant_id", "knowledge_items", ["tenant_id"])
    op.create_index("ix_knowledge_items_status", "knowledge_items", ["status"])

    op.create_table(
        "learning_paths",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.String(length=64), nullable=False),
        sa.Column("grade", sa.String(length=16), nullable=False),
        sa.Column("course_name", sa.String(length=255), nullable=False),
        sa.Column("learn_type", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("mastery", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("exam_mode", sa.String(length=32), nullable=False),
        sa.Column("duration", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_learning_paths_tenant_id", "learning_paths", ["tenant_id"])
    op.create_index("ix_learning_paths_position", "learning_paths", ["position"])


def downgrade() -> None:
    op.drop_index("ix_learning_paths_position", table_name="learning_paths")
    op.drop_index("ix_learning_paths_tenant_id", table_name="learning_paths")
    op.drop_table("learning_paths")
    op.drop_index("ix_knowledge_items_status", table_name="knowledge_items")
    op.drop_index("ix_knowledge_items_tenant_id", table_name="knowledge_items")
    op.drop_table("knowledge_items")
    op.drop_index("ix_training_instructors_tenant_id", table_name="training_instructors")
    op.drop_table("training_instructors")
    op.drop_index("ix_training_courses_type", table_name="training_courses")
    op.drop_index("ix_training_courses_tenant_id", table_name="training_courses")
    op.drop_table("training_courses")

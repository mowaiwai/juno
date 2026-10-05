"""RBAC 三支柱权限重构（ADR-0014）

Revision ID: a1b2c3d4e5f6
Revises: c3e5a7b9d102
Create Date: 2026-07-01

变更：
1. 部门静态树扶正为 departments 表；employees.dept_id 补外键。
2. 新增 tenant_roles / role_scopes（租户自定义角色 + ASSIGNED_DEPTS 授权）。
3. 新增 tenant_salary_bands；employees 加 base_salary / salary_updated_at。
4. users 加 active_role_ref。
5. 旧 HR 用户迁移：每租户建"综合 HR（一人全包）"预设自定义角色，
   hr 引用替换为 custom:<uuid>，默认激活该角色。
6. PG role 枚举标签由大写重建为 Role 枚举值（小写），移除 HR，
   新增 hr_coe_cadre/hr_coe_perf/hr_coe_comp/hr_coe_recruit/
   hr_coe_otd/hrbp/ssc；roles JSON 同步归一化为小写。
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

from app.models.types import UTCDateTime
from app.models.user import Role, custom_role_ref
from app.services.org_service import seed_departments
from app.services.role_service import ensure_preset_all_hr

revision = "a1b2c3d4e5f6"
down_revision = "c3e5a7b9d102"
branch_labels = None
depends_on = None

# 新枚举标签（与 app.models.user.Role 枚举值一致，小写）
ROLE_LABELS = [r.value for r in Role]


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # ------------------------------------------------------------------
    # 1. 新表
    # ------------------------------------------------------------------
    op.create_table(
        "departments",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("parent_id", sa.String(length=32), nullable=True),
        sa.Column(
            "type",
            sa.String(length=16),
            nullable=False,
            server_default="func",
        ),
        sa.Column("leader_employee_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", "tenant_id", name="pk_departments"),
        sa.ForeignKeyConstraint(
            ["parent_id", "tenant_id"],
            ["departments.id", "departments.tenant_id"],
            name="fk_departments_parent",
        ),
    )
    op.create_index("ix_departments_tenant_id", "departments", ["tenant_id"])
    op.create_index("ix_departments_parent_id", "departments", ["parent_id"])

    op.create_table(
        "tenant_roles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column(
            "scope_type",
            sa.String(length=16),
            nullable=False,
            server_default="global",
        ),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("cloned_from", sa.String(length=32), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
    )
    op.create_index("ix_tenant_roles_tenant_id", "tenant_roles", ["tenant_id"])

    op.create_table(
        "role_scopes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role_ref", sa.String(length=64), nullable=False),
        sa.Column("dept_id", sa.String(length=32), nullable=False),
        sa.Column(
            "include_subtree",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_role_scopes_tenant_id", "role_scopes", ["tenant_id"])
    op.create_index("ix_role_scopes_user_id", "role_scopes", ["user_id"])
    op.create_index("ix_role_scopes_role_ref", "role_scopes", ["role_ref"])
    op.create_index("ix_role_scopes_dept_id", "role_scopes", ["dept_id"])

    op.create_table(
        "tenant_salary_bands",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("grade", sa.String(length=32), nullable=False),
        sa.Column("min_value", sa.Integer(), nullable=False),
        sa.Column("max_value", sa.Integer(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
        sa.UniqueConstraint("tenant_id", "grade", name="tsb_tenant_grade_uc"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
    )
    op.create_index(
        "ix_tenant_salary_bands_tenant_id",
        "tenant_salary_bands",
        ["tenant_id"],
    )

    # ------------------------------------------------------------------
    # 2. employees 加列 + dept 外键；departments 领导外键
    # ------------------------------------------------------------------
    op.add_column(
        "employees",
        sa.Column("base_salary", sa.Integer(), nullable=True),
    )
    op.add_column(
        "employees",
        sa.Column("salary_updated_at", sa.DateTime(), nullable=True),
    )
    op.create_foreign_key(
        "fk_employees_dept", "employees", "departments",
        ["dept_id", "tenant_id"], ["id", "tenant_id"],
    )
    op.create_foreign_key(
        None, "departments", "employees",
        ["leader_employee_id"], ["id"],
    )
    # 审计支持无单一实体的批量动作（授角/差距分析等）
    op.alter_column("audit_logs", "entity_id", nullable=True)

    # ------------------------------------------------------------------
    # 3. users 加 active_role_ref
    # ------------------------------------------------------------------
    op.add_column(
        "users",
        sa.Column("active_role_ref", sa.String(length=64), nullable=True),
    )

    # ------------------------------------------------------------------
    # 4. 旧 HR 用户迁移（Core SQL，避免新枚举类型反序列化旧 'HR' 行失败）
    #
    # 旧库 roles JSON 存枚举成员名（大写，如 "HR"）。roles 是 JSON 无枚举
    # 约束，可直接写归一化后的小写引用；users.role 列在 PG 上仍是旧枚举，
    # HR 行先改写为旧枚举合法值 'EMPLOYEE'，第 5 步重建枚举后再统一小写。
    # ------------------------------------------------------------------
    users_t = sa.table(
        "users",
        sa.column("id", sa.Uuid),
        sa.column("tenant_id", sa.Uuid),
        sa.column("role", sa.String),
        sa.column("roles", sa.JSON),
        sa.column("active_role_ref", sa.String),
    )

    conn = bind
    tenant_rows = conn.execute(sa.text("SELECT id FROM tenants")).all()

    session = Session(bind=bind)
    try:
        for (tenant_id,) in tenant_rows:
            preset = ensure_preset_all_hr(session, tenant_id)
            session.flush()
            preset_ref = custom_role_ref(preset.id)

            rows = conn.execute(
                sa.text(
                    "SELECT id, role, roles FROM users WHERE tenant_id = :tid"
                ),
                {"tid": tenant_id},
            ).all()
            for user_id, role_col, roles_col in rows:
                raw_refs = list(roles_col or [])
                normalized: list[str] = []
                had_hr = False
                for raw in raw_refs:
                    # 大写成员名（旧库）→ 小写枚举值
                    if raw.isupper():
                        if raw == "HR":
                            had_hr = True
                            continue
                        try:
                            ref = Role[raw].value
                        except KeyError:
                            continue
                    else:
                        ref = raw
                    if ref not in normalized:
                        normalized.append(ref)

                if had_hr and preset_ref not in normalized:
                    normalized.append(preset_ref)

                if is_pg:
                    # 旧枚举仍是大写标签：HR 已剔除，其余保持大写
                    new_role = "EMPLOYEE" if had_hr else role_col
                else:
                    new_role = "employee" if had_hr else role_col.lower()

                conn.execute(
                    sa.update(users_t)
                    .where(users_t.c.id == user_id)
                    .values(
                        role=new_role,
                        roles=normalized,
                        active_role_ref=(
                            preset_ref if had_hr else None
                        ),
                    )
                )
    except Exception:
        raise
    finally:
        session.close()

    # ------------------------------------------------------------------
    # 5. PG 枚举重建（大写标签 → 小写枚举值，移除 HR，加入七个新角色）
    # ------------------------------------------------------------------
    if is_pg:
        labels = ", ".join(f"'{label}'" for label in ROLE_LABELS)
        op.execute("ALTER TYPE role RENAME TO role_old")
        op.execute(f"CREATE TYPE role AS ENUM ({labels})")
        op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
        op.execute(
            "ALTER TABLE users ALTER COLUMN role TYPE role "
            "USING lower(role::text)::role"
        )
        op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee'")
        op.execute("DROP TYPE role_old")

    # ------------------------------------------------------------------
    # 6. 部门树扶正 + 种子领导授角（枚举切换完成后再走 ORM）
    # ------------------------------------------------------------------
    session = Session(bind=bind)
    try:
        for (tenant_id,) in tenant_rows:
            seed_departments(session, tenant_id)
        session.flush()
    finally:
        session.close()


def downgrade() -> None:
    # 三支柱重构不提供自动回滚（枚举重建不可逆）；如需回退请从备份恢复。
    pass

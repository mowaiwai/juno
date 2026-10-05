import { useEffect, useMemo, useState, type Key } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tree,
  message,
} from 'antd';
import {
  ApartmentOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { USE_MOCK } from '@/api/config';
import {
  rolesApi,
  type BuiltinRole,
  type CustomRole,
  type CustomRoleInput,
  type PermissionGroup,
  type RoleCatalog,
  type RoleScopeDept,
  type ScopeType,
  type UserGrant,
  type UserListItem,
} from '@/api/roles';
import { orgApi, type DepartmentItem } from '@/api/org';
import { ROLE_META, resolveRoleMeta } from '@/auth/rbac';
import type { DataScope } from '@/types';
import { personas } from '@/mock/people';
import { useAuth } from '@/store/auth';

// ========================= 静态演示数据（USE_MOCK） =========================

const MOCK_GROUPS: PermissionGroup[] = [
  {
    code: 'employee',
    title: '员工与名册',
    points: [
      { code: 'employee.view', label: '员工名册查看' },
      { code: 'employee.field.basic.edit', label: '员工基本信息编辑' },
      { code: 'employee.salary.view', label: '薪酬明文查看' },
      { code: 'employee.perf.view', label: '绩效结果查看' },
    ],
  },
  {
    code: 'org',
    title: '组织与标准',
    points: [
      { code: 'org.manage', label: '组织架构管理' },
      { code: 'position.manage', label: '岗位编制管理' },
      { code: 'standard.manage', label: '任职资格标准管理' },
      { code: 'training.manage', label: '培训运营管理' },
    ],
  },
  {
    code: 'perf',
    title: '绩效与盘点',
    points: [
      { code: 'perf.standard.manage', label: '绩效标准管理' },
      { code: 'perf.result.import', label: '绩效结果导入' },
      { code: 'inventory.manage', label: '盘点批次管理' },
      { code: 'inventory.calibrate', label: '九宫格校准' },
    ],
  },
  {
    code: 'talent',
    title: '干部与继任',
    points: [
      { code: 'succession.manage', label: '继任矩阵管理' },
      { code: 'talent.pool.manage', label: '梯队池管理' },
      { code: 'coaching.manage', label: '辅导记录管理' },
    ],
  },
  {
    code: 'cert',
    title: '认证',
    points: [
      { code: 'cert.review', label: '认证材料预审' },
      { code: 'cert.vote', label: '认证评审投票' },
      { code: 'cert.publish', label: '认证结果发布' },
    ],
  },
  {
    code: 'salary',
    title: '薪酬激励',
    points: [
      { code: 'salary.table.view', label: '薪酬表查看' },
      { code: 'salary.plan.manage', label: '调薪方案管理' },
      { code: 'salary.approve', label: '调薪审批' },
    ],
  },
  {
    code: 'recruit',
    title: '招聘与考试',
    points: [
      { code: 'recruit.manage', label: '招聘工作台管理' },
      { code: 'exam.manage', label: '考试运营管理' },
      { code: 'interview.bank.manage', label: '面试题库管理' },
    ],
  },
  {
    code: 'tenant',
    title: '租户管理',
    points: [
      { code: 'roles.manage', label: '角色模板管理' },
      { code: 'roles.assign', label: '用户授角' },
      { code: 'config.manage', label: '租户配置管理' },
      { code: 'template.manage', label: '模板市场管理' },
      { code: 'usage.view', label: '用量与导出查看' },
    ],
  },
];

/** 内置 DataScope → 后端 scope_type */
function scopeToType(scope: DataScope): ScopeType {
  switch (scope) {
    case 'SELF':
      return 'self';
    case 'SUBTREE':
      return 'subtree';
    case 'ASSIGNED_DEPTS':
      return 'assigned_depts';
    case 'RELATED':
      return 'assigned_depts';
    default:
      return 'global';
  }
}

const SCOPE_TYPE_TAG: Record<ScopeType, string> = {
  self: '仅本人',
  subtree: '所辖子树',
  assigned_depts: '授权部门',
  global: '全公司',
};

const NOT_CLONEABLE = new Set(['employee', 'tenant_admin', 'platform_admin']);

const MOCK_BUILTIN_PERMS: Record<string, string[]> = {
  employee: ['employee.view'],
  manager: ['employee.view', 'employee.perf.view', 'cert.review'],
  cert_panel: ['cert.vote', 'cert.review'],
  committee: ['cert.vote', 'cert.publish'],
  exec: [
    'employee.view',
    'employee.perf.view',
    'salary.approve',
    'inventory.calibrate',
  ],
  tenant_admin: [
    'roles.manage',
    'roles.assign',
    'config.manage',
    'template.manage',
    'usage.view',
    'employee.view',
    'employee.salary.view',
    'employee.perf.view',
    'employee.field.basic.edit',
  ],
  platform_admin: ['config.manage', 'usage.view'],
  hr_coe_cadre: [
    'employee.view',
    'employee.perf.view',
    'succession.manage',
    'talent.pool.manage',
    'inventory.calibrate',
  ],
  hr_coe_perf: [
    'employee.view',
    'employee.perf.view',
    'perf.standard.manage',
    'perf.result.import',
    'inventory.calibrate',
  ],
  hr_coe_comp: [
    'employee.view',
    'employee.salary.view',
    'salary.table.view',
    'salary.plan.manage',
  ],
  hr_coe_recruit: [
    'employee.view',
    'recruit.manage',
    'exam.manage',
    'interview.bank.manage',
  ],
  hr_coe_otd: [
    'employee.view',
    'employee.perf.view',
    'employee.field.basic.edit',
    'org.manage',
    'position.manage',
    'standard.manage',
    'training.manage',
    'exam.manage',
    'inventory.manage',
    'inventory.calibrate',
  ],
  hrbp: [
    'employee.view',
    'employee.perf.view',
    'coaching.manage',
    'recruit.manage',
  ],
  ssc: ['employee.view'],
};

function buildMockCatalog(): RoleCatalog {
  const builtin_roles: BuiltinRole[] = Object.entries(ROLE_META).map(
    ([ref, meta]) => ({
      ref,
      name: meta.label,
      scope_type: scopeToType(meta.scope),
      cloneable: !NOT_CLONEABLE.has(ref),
      permissions: MOCK_BUILTIN_PERMS[ref] ?? [],
    }),
  );
  return {
    groups: MOCK_GROUPS,
    builtin_roles,
    cloneable: builtin_roles.filter((b) => b.cloneable).map((b) => b.ref),
    scope_types: ['self', 'subtree', 'assigned_depts', 'global'],
  };
}

const MOCK_CUSTOM_ROLES: CustomRole[] = [
  {
    id: 'mock-1',
    ref: 'custom:demo-recruit-bp',
    name: '招聘 BP（外包项目）',
    scope_type: 'assigned_depts',
    permissions: ['employee.view', 'recruit.manage', 'interview.bank.manage'],
    updated_at: '2025-06-18 10:20',
  },
];

function buildMockUsers(): UserListItem[] {
  return personas.map((p) => ({
    id: p.id,
    tenant_id: p.tenantId,
    email: `${p.id}@juno.test`,
    name: p.name,
    active_role_ref: p.defaultRole,
    role_refs: p.roles as string[],
  }));
}

interface DeptNode {
  key: string;
  title: string;
  children?: DeptNode[];
}

// ========================= 页面 =========================

type RoleDraft = {
  id: string | null;
  name: string;
  scope_type: ScopeType;
  permissions: string[];
};

export function RoleAdmin() {
  const activeRole = useAuth((s) => s.activeRole);

  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<RoleCatalog | null>(null);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [grants, setGrants] = useState<UserGrant[]>([]);
  const [grantRef, setGrantRef] = useState<string | undefined>();
  /** mock 模式下维护各用户「用户×角色」的授权部门 */
  const [scopesMap, setScopesMap] = useState<Record<string, RoleScopeDept[]>>(
    {},
  );

  const [roleDraft, setRoleDraft] = useState<RoleDraft | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [cloneFrom, setCloneFrom] = useState<BuiltinRole | null>(null);
  const [cloneName, setCloneName] = useState('');

  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [scopeEditing, setScopeEditing] = useState<{
    roleRef: string;
    roleName: string;
  } | null>(null);
  const [checkedDepts, setCheckedDepts] = useState<string[]>([]);
  const [includeSubtree, setIncludeSubtree] = useState(true);

  useEffect(() => {
    if (activeRole !== 'tenant_admin') return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        if (USE_MOCK) {
          setCatalog(buildMockCatalog());
          setCustomRoles(MOCK_CUSTOM_ROLES);
          setUsers(buildMockUsers());
        } else {
          const [c, cr, u] = await Promise.all([
            rolesApi.catalog(),
            rolesApi.listCustom(),
            rolesApi.users(),
          ]);
          if (cancelled) return;
          setCatalog(c);
          setCustomRoles(cr);
          setUsers(u);
        }
      } catch {
        message.error('角色数据加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRole]);

  // 部门树（数据范围配置用）
  useEffect(() => {
    if (activeRole !== 'tenant_admin') return;
    void orgApi
      .departments()
      .then(setDepts)
      .catch(() => undefined);
  }, [activeRole]);

  const permLabel = useMemo(() => {
    const m = new Map<string, string>();
    catalog?.groups.forEach((g) =>
      g.points.forEach((p) => m.set(p.code, `${g.title} / ${p.label}`)),
    );
    return m;
  }, [catalog]);

  const allRoleRefs = useMemo(
    () => [
      ...(catalog?.builtin_roles ?? []),
      ...customRoles.map((c) => ({
        ref: c.ref,
        name: c.name,
        scope_type: c.scope_type,
        cloneable: false,
        permissions: c.permissions,
      })),
    ],
    [catalog, customRoles],
  );

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  // 选中用户 → 加载授角
  useEffect(() => {
    if (!selectedUserId) {
      setGrants([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (USE_MOCK) {
          const u = users.find((x) => x.id === selectedUserId);
          if (!u || cancelled) return;
          setGrants(
            u.role_refs.map((ref) => {
              const meta = resolveRoleMeta(ref);
              return {
                ref,
                name: meta.label,
                kind: ref.startsWith('custom:') ? 'custom' : 'builtin',
                scope_type: scopeToType(meta.scope),
                active: ref === u.active_role_ref,
              } as UserGrant;
            }),
          );
        } else {
          // 后端 GET /grants 返回 { active_role_ref, role_refs, scopes }
          // （扁平授权部门），前端映射成授角行，并按角色分组缓存部门授权
          const data = await rolesApi.grants(selectedUserId);
          if (cancelled) return;
          setGrants(
            data.role_refs.map((ref) => {
              const meta = resolveRoleMeta(ref);
              return {
                ref,
                name: meta.label,
                kind: ref.startsWith('custom:') ? 'custom' : 'builtin',
                scope_type: scopeToType(meta.scope),
                active: ref === data.active_role_ref,
              } as UserGrant;
            }),
          );
          setScopesMap((m) => {
            const next: Record<string, RoleScopeDept[]> = {};
            for (const [k, v] of Object.entries(m)) {
              if (!k.startsWith(`${selectedUserId}::`)) next[k] = v;
            }
            for (const row of data.scopes) {
              const key = scopeMapKey(selectedUserId, row.role_ref);
              (next[key] ??= []).push({
                dept_id: row.dept_id,
                include_subtree: row.include_subtree,
              });
            }
            return next;
          });
        }
      } catch {
        message.error('授角记录加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, users]);

  // ---------- 自定义角色 CRUD ----------

  const openCreate = () => {
    setRoleDraft({
      id: null,
      name: '',
      scope_type: 'assigned_depts',
      permissions: [],
    });
  };

  const openEdit = (role: CustomRole) => {
    setRoleDraft({
      id: role.id,
      name: role.name,
      scope_type: role.scope_type,
      permissions: [...role.permissions],
    });
  };

  const togglePerm = (code: string, checked: boolean) => {
    setRoleDraft((d) => {
      if (!d) return d;
      const permissions = checked
        ? [...d.permissions, code]
        : d.permissions.filter((p) => p !== code);
      return { ...d, permissions };
    });
  };

  const saveRole = async () => {
    if (!roleDraft) return;
    if (!roleDraft.name.trim()) {
      message.warning('请填写角色名称');
      return;
    }
    const input: CustomRoleInput = {
      name: roleDraft.name.trim(),
      scope_type: roleDraft.scope_type,
      permissions: roleDraft.permissions,
    };
    setSavingRole(true);
    try {
      if (roleDraft.id) {
        if (USE_MOCK) {
          setCustomRoles((list) =>
            list.map((r) =>
              r.id === roleDraft.id
                ? { ...r, ...input, updated_at: '刚刚' }
                : r,
            ),
          );
        } else {
          const updated = await rolesApi.updateCustom(roleDraft.id, input);
          setCustomRoles((list) =>
            list.map((r) => (r.id === roleDraft.id ? updated : r)),
          );
        }
        message.success('自定义角色已更新');
      } else {
        if (USE_MOCK) {
          const id = `local-${Date.now()}`;
          setCustomRoles((list) => [
            {
              id,
              ref: `custom:${id}`,
              ...input,
              created_at: '刚刚',
              updated_at: '刚刚',
            },
            ...list,
          ]);
        } else {
          const created = await rolesApi.createCustom(input);
          setCustomRoles((list) => [created, ...list]);
        }
        message.success('自定义角色已创建');
      }
      setRoleDraft(null);
    } catch {
      message.error('保存失败，请重试');
    } finally {
      setSavingRole(false);
    }
  };

  const removeRole = (role: CustomRole) => {
    Modal.confirm({
      title: `删除自定义角色「${role.name}」？`,
      content: '已持有该角色的用户将同步失去对应权限。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          if (!USE_MOCK) await rolesApi.deleteCustom(role.id);
          setCustomRoles((list) => list.filter((r) => r.id !== role.id));
          message.success('已删除');
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const confirmClone = async () => {
    if (!cloneFrom) return;
    if (!cloneName.trim()) {
      message.warning('请填写新角色名称');
      return;
    }
    try {
      if (USE_MOCK) {
        const id = `local-${Date.now()}`;
        setCustomRoles((list) => [
          {
            id,
            ref: `custom:${id}`,
            name: cloneName.trim(),
            scope_type: cloneFrom.scope_type,
            permissions: [...cloneFrom.permissions],
            created_at: '刚刚',
            updated_at: '刚刚',
          },
          ...list,
        ]);
      } else {
        const created = await rolesApi.cloneBuiltin(
          cloneFrom.ref,
          cloneName.trim(),
        );
        setCustomRoles((list) => [created, ...list]);
      }
      message.success('已基于内置模板创建自定义角色');
      setCloneFrom(null);
      setCloneName('');
    } catch {
      message.error('克隆失败');
    }
  };

  // ---------- 用户授角 ----------

  const refreshUsers = async () => {
    if (USE_MOCK) return;
    try {
      setUsers(await rolesApi.users());
    } catch {
      message.error('用户列表刷新失败');
    }
  };

  const doGrant = async () => {
    if (!selectedUser || !grantRef) return;
    try {
      if (!USE_MOCK) await rolesApi.grant(selectedUser.id, grantRef);
      const ref = grantRef;
      const tpl = allRoleRefs.find((r) => r.ref === ref);
      setGrants((list) => [
        ...list,
        {
          ref,
          name: tpl?.name ?? ref,
          kind: ref.startsWith('custom:') ? 'custom' : 'builtin',
          scope_type: tpl?.scope_type ?? 'assigned_depts',
          active: false,
        },
      ]);
      if (USE_MOCK) {
        setUsers((list) =>
          list.map((u) =>
            u.id === selectedUser.id
              ? { ...u, role_refs: [...u.role_refs, ref] }
              : u,
          ),
        );
      }
      setGrantRef(undefined);
      message.success('授角成功');
    } catch {
      message.error('授角失败');
    }
  };

  const doRevoke = (ref: string) => {
    if (!selectedUser) return;
    Modal.confirm({
      title: '收回该角色？',
      content: '收回后该用户将立即失去此角色的全部权限。',
      okText: '收回',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          if (!USE_MOCK) await rolesApi.revoke(selectedUser.id, ref);
          setGrants((list) => list.filter((g) => g.ref !== ref));
          if (USE_MOCK) {
            setUsers((list) =>
              list.map((u) =>
                u.id === selectedUser.id
                  ? {
                      ...u,
                      role_refs: u.role_refs.filter((r) => r !== ref),
                      active_role_ref:
                        u.active_role_ref === ref ? null : u.active_role_ref,
                    }
                  : u,
              ),
            );
          }
          message.success('已收回');
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  const doSetActive = async (ref: string) => {
    if (!selectedUser) return;
    try {
      if (!USE_MOCK) await rolesApi.setActiveRole(selectedUser.id, ref);
      setGrants((list) =>
        list.map((g) => ({ ...g, active: g.ref === ref })),
      );
      if (USE_MOCK) {
        setUsers((list) =>
          list.map((u) =>
            u.id === selectedUser.id ? { ...u, active_role_ref: ref } : u,
          ),
        );
      }
      message.success('已设为该用户的激活角色');
    } catch {
      message.error('设置失败');
    }
  };

  // ---------- 数据范围（授权部门） ----------

  const deptTreeData = useMemo<DeptNode[]>(() => {
    const map = new Map<string, DeptNode>();
    const roots: DeptNode[] = [];
    depts.forEach((d) =>
      map.set(d.id, { key: d.id, title: d.name, children: [] }),
    );
    map.forEach((node, id) => {
      const raw = depts.find((d) => d.id === id);
      const parentId = raw?.parent_id;
      const parent = parentId ? map.get(parentId) : undefined;
      if (parent && parentId !== id) parent.children!.push(node);
      else roots.push(node);
    });
    // 清理空 children，避免全部门旁出现展开箭头
    const clean = (nodes: DeptNode[]): DeptNode[] =>
      nodes
        .map((n) =>
          n.children && n.children.length > 0
            ? { ...n, children: clean(n.children) }
            : { key: n.key, title: n.title },
        );
    return clean(roots);
  }, [depts]);

  const scopeMapKey = (userId: string, ref: string) => `${userId}::${ref}`;

  const openScope = (grant: UserGrant) => {
    if (!selectedUser) return;
    // 授权部门在加载授角时已随 GET /grants 的 scopes 一并缓存
    const existing: RoleScopeDept[] =
      scopesMap[scopeMapKey(selectedUser.id, grant.ref)] ?? [];
    setScopeEditing({ roleRef: grant.ref, roleName: grant.name });
    setCheckedDepts(existing.map((d) => d.dept_id));
    setIncludeSubtree(existing[0]?.include_subtree ?? true);
  };

  const saveScope = async () => {
    if (!selectedUser || !scopeEditing) return;
    const body = {
      role_ref: scopeEditing.roleRef,
      depts: checkedDepts.map((dept_id) => ({ dept_id, include_subtree: includeSubtree })),
    };
    try {
      if (!USE_MOCK) {
        await rolesApi.setScopes(selectedUser.id, body);
      }
      setScopesMap((m) => ({
        ...m,
        [scopeMapKey(selectedUser.id, scopeEditing.roleRef)]: body.depts,
      }));
      message.success('授权部门已保存');
      setScopeEditing(null);
    } catch {
      message.error('保存失败');
    }
  };

  // ========================= 渲染 =========================

  if (activeRole !== 'tenant_admin') {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="角色与权限仅租户管理员可访问" />
        </Card>
      </div>
    );
  }

  const builtinColumns: ColumnsType<BuiltinRole> = [
    {
      title: '内置模板',
      dataIndex: 'name',
      width: 220,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600 }}>{r.name}</span>
          <span className="num" style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            {r.ref}
          </span>
        </Space>
      ),
    },
    {
      title: '数据范围',
      dataIndex: 'scope_type',
      width: 120,
      render: (v: ScopeType) => (
        <Tag style={{ borderRadius: 6 }}>{SCOPE_TYPE_TAG[v] ?? v}</Tag>
      ),
    },
    {
      title: '权限点',
      dataIndex: 'permissions',
      render: (perms: string[]) => (
        <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>
          {perms.length} 个（展开查看）
        </span>
      ),
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <Button
          type="link"
          size="small"
          disabled={!r.cloneable}
          icon={<CopyOutlined />}
          onClick={() => {
            setCloneFrom(r);
            setCloneName(`${r.name} 副本`);
          }}
        >
          克隆
        </Button>
      ),
    },
  ];

  const customColumns: ColumnsType<CustomRole> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 220,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Space size={6}>
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <Tag
              color="purple"
              style={{ borderRadius: 6, marginInlineEnd: 0 }}
            >
              自定义
            </Tag>
          </Space>
          <span className="num" style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            {r.ref}
          </span>
        </Space>
      ),
    },
    {
      title: '数据范围',
      dataIndex: 'scope_type',
      width: 120,
      render: (v: ScopeType) => (
        <Tag style={{ borderRadius: 6 }}>{SCOPE_TYPE_TAG[v] ?? v}</Tag>
      ),
    },
    {
      title: '权限点',
      dataIndex: 'permissions',
      render: (perms: string[]) => (
        <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>
          {perms.length} 个（展开查看）
        </span>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 150,
      render: (v?: string) => v ?? '—',
    },
    {
      title: '操作',
      width: 140,
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(r)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeRole(r)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const grantColumns: ColumnsType<UserGrant> = [
    {
      title: '角色',
      dataIndex: 'name',
      render: (_, r) => (
        <Space size={6}>
          <span>{r.name}</span>
          {r.kind === 'custom' && (
            <Tag color="purple" style={{ borderRadius: 6, marginInlineEnd: 0 }}>
              自定义
            </Tag>
          )}
          {r.active && (
            <Tag color="green" style={{ borderRadius: 6, marginInlineEnd: 0 }}>
              激活中
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '范围',
      dataIndex: 'scope_type',
      width: 110,
      render: (v: ScopeType) => (
        <Tag style={{ borderRadius: 6 }}>{SCOPE_TYPE_TAG[v] ?? v}</Tag>
      ),
    },
    {
      title: '操作',
      width: 250,
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            disabled={r.active}
            onClick={() => doSetActive(r.ref)}
          >
            设为激活
          </Button>
          {r.scope_type === 'assigned_depts' && (
            <Button
              type="link"
              size="small"
              icon={<ApartmentOutlined />}
              onClick={() => openScope(r)}
            >
              授权部门
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            onClick={() => doRevoke(r.ref)}
          >
            收回
          </Button>
        </Space>
      ),
    },
  ];

  const grantedRefs = new Set(grants.map((g) => g.ref));
  const grantOptions = allRoleRefs
    .filter((r) => !grantedRefs.has(r.ref))
    .map((r) => ({ value: r.ref, label: r.name }));

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">角色与权限</h1>
          <div className="page-subtitle">
            内置模板克隆、自定义角色与权限点、用户授角与数据范围（服务端按激活角色鉴权）
          </div>
        </div>
      </div>

      {USE_MOCK && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="原型演示模式：以下数据为静态示例，CRUD 仅在本地生效；接入后端后走 /roles/* 真实接口。"
        />
      )}

      {/* ① 内置模板与权限目录 */}
      <Card
        variant="borderless"
        style={{ background: 'var(--surface)', marginBottom: 16 }}
        title={
          <Space>
            <SafetyOutlined />
            <span>内置角色模板与权限目录</span>
          </Space>
        }
        size="small"
      >
        <Collapse
          ghost
          size="small"
          style={{ marginBottom: 8 }}
          items={(catalog?.groups ?? []).map((g) => ({
            key: g.code,
            label: (
              <span style={{ fontWeight: 600 }}>
                {g.title}
                <span style={{ color: 'var(--ink-4)', fontWeight: 400, marginLeft: 8 }}>
                  {g.points.length} 个权限点
                </span>
              </span>
            ),
            children: (
              <Space size={[6, 6]} wrap>
                {g.points.map((p) => (
                  <Tag
                    key={p.code}
                    style={{
                      borderRadius: 6,
                      background: 'var(--surface-sunken)',
                      borderColor: 'var(--line)',
                      color: 'var(--ink-2)',
                    }}
                  >
                    {p.label}
                    <span className="num" style={{ color: 'var(--ink-4)', marginLeft: 6, fontSize: 11 }}>
                      {p.code}
                    </span>
                  </Tag>
                ))}
              </Space>
            ),
          }))}
        />
        <Table
          rowKey="ref"
          size="small"
          loading={loading}
          columns={builtinColumns}
          dataSource={catalog?.builtin_roles ?? []}
          pagination={false}
          expandable={{
            expandedRowRender: (r) => (
              <Space size={[6, 6]} wrap>
                {r.permissions.map((code) => (
                  <Tag key={code} style={{ borderRadius: 6 }}>
                    {permLabel.get(code) ?? code}
                  </Tag>
                ))}
              </Space>
            ),
            rowExpandable: (r) => r.permissions.length > 0,
          }}
        />
      </Card>

      {/* ② 自定义角色 */}
      <Card
        variant="borderless"
        style={{ background: 'var(--surface)', marginBottom: 16 }}
        title={
          <Space>
            <SafetyOutlined />
            <span>自定义角色</span>
          </Space>
        }
        size="small"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建自定义角色
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={customColumns}
          dataSource={customRoles}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无自定义角色，可从内置模板克隆或新建"
              />
            ),
          }}
          expandable={{
            expandedRowRender: (r) => (
              <Space size={[6, 6]} wrap>
                {r.permissions.map((code) => (
                  <Tag key={code} style={{ borderRadius: 6 }}>
                    {permLabel.get(code) ?? code}
                  </Tag>
                ))}
              </Space>
            ),
            rowExpandable: (r) => r.permissions.length > 0,
          }}
        />
      </Card>

      {/* ③ 用户授角 */}
      <Card
        variant="borderless"
        style={{ background: 'var(--surface)' }}
        title={
          <Space>
            <TeamOutlined />
            <span>用户授角与数据范围</span>
          </Space>
        }
        size="small"
      >
        <Table<UserListItem>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={users}
          pagination={{ pageSize: 6 }}
          onRow={(u) => ({
            onClick: () => setSelectedUserId(u.id),
            style: { cursor: 'pointer' },
          })}
          rowClassName={(u) =>
            u.id === selectedUserId ? 'ant-table-row-selected' : ''
          }
          columns={[
            {
              title: '用户',
              dataIndex: 'name',
              render: (_, u) => (
                <Space direction="vertical" size={0}>
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                    {u.email}
                  </span>
                </Space>
              ),
            },
            {
              title: '激活角色',
              dataIndex: 'active_role_ref',
              width: 200,
              render: (ref: string | null) =>
                ref ? (
                  <Tag color="green" style={{ borderRadius: 6 }}>
                    {resolveRoleMeta(ref).label}
                  </Tag>
                ) : (
                  <span style={{ color: 'var(--ink-4)' }}>未设置</span>
                ),
            },
            {
              title: '持有角色数',
              dataIndex: 'role_refs',
              width: 110,
              render: (refs: string[]) => refs.length,
            },
          ]}
        />

        {selectedUser ? (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: 8,
                color: 'var(--ink-2)',
              }}
            >
              {selectedUser.name} 的角色
            </div>
            <Space style={{ marginBottom: 12 }}>
              <Select
                showSearch
                placeholder="选择要授予的角色"
                style={{ width: 280 }}
                value={grantRef}
                onChange={setGrantRef}
                options={grantOptions}
                filterOption={(input, opt) =>
                  String(opt?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
              <Button
                type="primary"
                disabled={!grantRef}
                onClick={doGrant}
              >
                授角
              </Button>
              {!USE_MOCK && (
                <Button onClick={refreshUsers}>刷新用户状态</Button>
              )}
            </Space>
            <Table
              rowKey="ref"
              size="small"
              columns={grantColumns}
              dataSource={grants}
              pagination={false}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="该用户尚未持有任何角色"
                  />
                ),
              }}
            />
          </div>
        ) : (
          <Empty
            style={{ marginTop: 16 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="点击上方用户以管理授角"
          />
        )}
      </Card>

      {/* 自定义角色 新建/编辑 Modal */}
      <Modal
        title={roleDraft?.id ? '编辑自定义角色' : '新建自定义角色'}
        open={roleDraft !== null}
        onCancel={() => setRoleDraft(null)}
        onOk={saveRole}
        confirmLoading={savingRole}
        okText="保存"
        cancelText="取消"
        width={680}
        destroyOnClose
      >
        {roleDraft && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 6, color: 'var(--ink-3)' }}>角色名称</div>
              <Input
                placeholder="例如：招聘 BP（外包项目）"
                value={roleDraft.name}
                onChange={(e) =>
                  setRoleDraft({ ...roleDraft, name: e.target.value })
                }
              />
            </div>
            <div>
              <div style={{ marginBottom: 6, color: 'var(--ink-3)' }}>数据范围</div>
              <Select
                style={{ width: '100%' }}
                value={roleDraft.scope_type}
                onChange={(v: ScopeType) =>
                  setRoleDraft({ ...roleDraft, scope_type: v })
                }
                options={(catalog?.scope_types ?? [
                  'self',
                  'subtree',
                  'assigned_depts',
                  'global',
                ]).map((v) => ({
                  value: v,
                  label: SCOPE_TYPE_TAG[v as ScopeType] ?? v,
                }))}
              />
            </div>
            <div>
              <div style={{ marginBottom: 6, color: 'var(--ink-3)' }}>
                权限点
              </div>
              <Space
                direction="vertical"
                size={10}
                style={{ width: '100%' }}
              >
                {(catalog?.groups ?? []).map((g) => (
                  <div
                    key={g.code}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: 'var(--surface-sunken)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      {g.title}
                    </div>
                    <Space size={[8, 8]} wrap>
                      {g.points.map((p) => (
                        <Checkbox
                          key={p.code}
                          checked={roleDraft.permissions.includes(p.code)}
                          onChange={(e) =>
                            togglePerm(p.code, e.target.checked)
                          }
                        >
                          {p.label}
                        </Checkbox>
                      ))}
                    </Space>
                  </div>
                ))}
              </Space>
            </div>
          </Space>
        )}
      </Modal>

      {/* 克隆内置模板 Modal */}
      <Modal
        title={cloneFrom ? `克隆模板：${cloneFrom.name}` : ''}
        open={cloneFrom !== null}
        onCancel={() => setCloneFrom(null)}
        onOk={confirmClone}
        okText="创建"
        cancelText="取消"
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`将复制 ${cloneFrom?.permissions.length ?? 0} 个权限点，数据范围为「${
            cloneFrom ? SCOPE_TYPE_TAG[cloneFrom.scope_type] : ''
          }」，创建后可自由调整。`}
        />
        <div style={{ marginBottom: 6, color: 'var(--ink-3)' }}>新角色名称</div>
        <Input
          value={cloneName}
          onChange={(e) => setCloneName(e.target.value)}
          placeholder="请输入自定义角色名称"
        />
      </Modal>

      {/* 授权部门 Modal */}
      <Modal
        title={
          scopeEditing
            ? `授权部门：${scopeEditing.roleName}`
            : ''
        }
        open={scopeEditing !== null}
        onCancel={() => setScopeEditing(null)}
        onOk={saveScope}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Space
          direction="vertical"
          size={12}
          style={{ width: '100%' }}
        >
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            勾选该角色可访问的部门（ASSIGNED_DEPTS 数据范围）。
          </div>
          <Space>
            <span style={{ color: 'var(--ink-3)' }}>所选部门含下级组织</span>
            <Switch
              checked={includeSubtree}
              onChange={setIncludeSubtree}
            />
          </Space>
          <div
            style={{
              maxHeight: 360,
              overflow: 'auto',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '8px 12px',
              background: 'var(--surface-sunken)',
            }}
          >
            {deptTreeData.length > 0 ? (
              <Tree
                checkable
                checkStrictly
                defaultExpandAll
                checkedKeys={checkedDepts}
                treeData={deptTreeData}
                onCheck={(keys) => {
                  const checked = keys as unknown as {
                    checked: Key[];
                  };
                  setCheckedDepts(checked.checked.map((k) => String(k)));
                }}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="部门数据加载中"
              />
            )}
          </div>
        </Space>
      </Modal>
    </div>
  );
}

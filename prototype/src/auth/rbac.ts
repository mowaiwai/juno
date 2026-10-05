import type { BuiltinRoleCode, DataScope, RoleCode, RoleRef } from '@/types';
import { employees } from '@/mock/people';
import { subtreeDeptIds } from '@/mock/org';

export interface RoleMeta {
  label: string;
  scope: DataScope;
  /** 明文薪酬可见（后端 employee.salary.view 或通配管理员） */
  seeSalary: boolean;
  /** 绩效结果可见 */
  seePerf: boolean;
  /** 完整画像可见 */
  seeFullProfile: boolean;
  /** 员工基本信息可编辑（后端 employee.field.basic.edit，原型 mock 标志） */
  canEditBasic: boolean;
  description: string;
}

/**
 * 内置角色元信息。严格对齐后端权限模板：
 * - seeSalary 仅 hr_coe_comp 与 tenant_admin；
 * - seePerf 为 cadre/perf/otd/hrbp/manager/exec；
 * - exec/committee 不再默认可见薪酬明文。
 */
export const ROLE_META: Record<BuiltinRoleCode, RoleMeta> = {
  employee: {
    label: '员工',
    scope: 'SELF',
    seeSalary: false,
    seePerf: false,
    seeFullProfile: false,
    canEditBasic: false,
    description: '仅本人数据：画像、通道、IDP、认证',
  },
  manager: {
    label: '管理者',
    scope: 'SUBTREE',
    seeSalary: false,
    seePerf: true,
    seeFullProfile: true,
    canEditBasic: false,
    description: '所辖组织子树：团队画像、差距、审批',
  },
  cert_panel: {
    label: '认证小组',
    scope: 'RELATED',
    seeSalary: false,
    seePerf: false,
    seeFullProfile: true,
    canEditBasic: false,
    description: '被评审对象材料：只评审、不落库',
  },
  committee: {
    label: '管委会',
    scope: 'GLOBAL',
    seeSalary: false,
    seePerf: false,
    seeFullProfile: true,
    canEditBasic: false,
    description: '高等级认证终审，不可见薪酬明文',
  },
  exec: {
    label: '高管',
    scope: 'GLOBAL',
    seeSalary: false,
    seePerf: true,
    seeFullProfile: true,
    canEditBasic: false,
    description: '全量：三张图、审批、人才决策（薪酬明文掩码）',
  },
  tenant_admin: {
    label: '租户管理员',
    scope: 'GLOBAL',
    seeSalary: true,
    seePerf: true,
    seeFullProfile: false,
    canEditBasic: true,
    description: '本租户配置、角色授角、模板、用量与导出',
  },
  platform_admin: {
    label: '平台管理员',
    scope: 'PLATFORM',
    seeSalary: false,
    seePerf: false,
    seeFullProfile: false,
    canEditBasic: false,
    description: '平台级：租户与账单，不可见员工明文',
  },
  hr_coe_cadre: {
    label: 'COE·干部管理',
    scope: 'GLOBAL',
    seeSalary: false,
    seePerf: true,
    seeFullProfile: true,
    canEditBasic: false,
    description: '全公司：核心岗位、继任矩阵、梯队池、AB 角与干部盘点',
  },
  hr_coe_perf: {
    label: 'COE·绩效',
    scope: 'GLOBAL',
    seeSalary: false,
    seePerf: true,
    seeFullProfile: true,
    canEditBasic: false,
    description: '全公司：绩效标准、结果导入、校准与绩效改进',
  },
  hr_coe_comp: {
    label: 'COE·薪酬激励',
    scope: 'GLOBAL',
    seeSalary: true,
    seePerf: false,
    seeFullProfile: false,
    canEditBasic: false,
    description: '全公司：薪酬表、市场分位、调薪方案（可见薪酬明文）',
  },
  hr_coe_recruit: {
    label: 'COE·招聘运营',
    scope: 'GLOBAL',
    seeSalary: false,
    seePerf: false,
    seeFullProfile: false,
    canEditBasic: false,
    description: '全公司：招聘工作台、面试题库与考试运营',
  },
  hr_coe_otd: {
    label: 'COE·组织与人才发展',
    scope: 'GLOBAL',
    seeSalary: false,
    seePerf: true,
    seeFullProfile: true,
    canEditBasic: true,
    description: '全公司：组织架构、岗位、任职资格标准、盘点、培训与考试',
  },
  hrbp: {
    label: 'HRBP（业务伙伴）',
    scope: 'ASSIGNED_DEPTS',
    seeSalary: false,
    seePerf: true,
    seeFullProfile: true,
    canEditBasic: false,
    description: '授权部门范围：业务诊断、差距动作、IDP 与招募协同',
  },
  ssc: {
    label: 'SSC（共享服务）',
    scope: 'GLOBAL',
    seeSalary: false,
    seePerf: false,
    seeFullProfile: false,
    canEditBasic: false,
    description: '全公司只读名册与账号服务，不可见绩效/薪酬明文',
  },
};

/** 后端 scope_type → 前端 DataScope */
const SCOPE_FROM_BACKEND: Record<string, DataScope> = {
  self: 'SELF',
  subtree: 'SUBTREE',
  assigned_depts: 'ASSIGNED_DEPTS',
  global: 'GLOBAL',
};

export const SCOPE_LABEL: Record<DataScope, string> = {
  SELF: '仅本人',
  SUBTREE: '所辖组织子树',
  ASSIGNED_DEPTS: '授权部门',
  GLOBAL: '全公司',
  PLATFORM: '平台级',
  RELATED: '关联对象',
};

export function isBuiltinRole(ref: string): ref is BuiltinRoleCode {
  return !ref.startsWith('custom:') && ref in ROLE_META;
}

/**
 * 解析任意角色 ref（含 custom:<uuid>）的元信息。
 * @param ref 角色 ref
 * @param roleRefs 当前用户的 role_refs，custom 角色用其 name 作 label、scope_type 推导范围
 */
export function resolveRoleMeta(
  ref: string | null | undefined,
  roleRefs?: RoleRef[],
): RoleMeta {
  if (ref && isBuiltinRole(ref)) return ROLE_META[ref];
  const found = ref ? roleRefs?.find((r) => r.ref === ref) : undefined;
  const scope: DataScope =
    SCOPE_FROM_BACKEND[found?.scope_type ?? 'assigned_depts'] ??
    'ASSIGNED_DEPTS';
  return {
    label: found?.label || (ref ? `自定义角色 ${ref.slice(0, 12)}` : '未知角色'),
    scope,
    seeSalary: false,
    seePerf: false,
    seeFullProfile: false,
    canEditBasic: false,
    description: `自定义角色 · 数据范围：${SCOPE_LABEL[scope]}`,
  };
}

/** 判断 ref 是否为 HR 三支柱任意角色（COE + BP + SSC） */
export function isHrRole(ref: string | null | undefined): boolean {
  return !!ref && HR_ALL.includes(ref as RoleCode);
}

/** COE 五角色 */
export const HR_COE: RoleCode[] = [
  'hr_coe_cadre',
  'hr_coe_perf',
  'hr_coe_comp',
  'hr_coe_recruit',
  'hr_coe_otd',
];

/** 全部 HR 角色（COE + HRBP + SSC） */
export const HR_ALL: RoleCode[] = [...HR_COE, 'hrbp', 'ssc'];

/** 绩效模块能力（后端权限点 perf.plan.manage / perf.result.entry / perf.pip.manage） */
export interface PerfPerms {
  /** COE·绩效：方案/常量/导入/发布 */
  planManage: boolean;
  /** 主管/HRBP：数据范围内初评与辅导 */
  resultEntry: boolean;
  /** COE·绩效：PIP 建档与结论 */
  pipManage: boolean;
}

/**
 * 按激活角色推导绩效能力（服务端为最终裁决者，403 由页面兜底提示）。
 * custom 角色按数据范围启发式：global 视为 COE 综合包，子树/授权部门视为初评视角。
 */
export function perfPermsForRef(
  ref: string | null | undefined,
  scope?: DataScope,
): PerfPerms {
  if (ref === 'tenant_admin' || ref === 'hr_coe_perf') {
    return { planManage: true, resultEntry: true, pipManage: true };
  }
  if (ref === 'manager' || ref === 'hrbp') {
    return { planManage: false, resultEntry: true, pipManage: false };
  }
  if (ref?.startsWith('custom:')) {
    if (scope === 'GLOBAL') {
      return { planManage: true, resultEntry: true, pipManage: true };
    }
    if (scope === 'SUBTREE' || scope === 'ASSIGNED_DEPTS') {
      return { planManage: false, resultEntry: true, pipManage: false };
    }
  }
  return { planManage: false, resultEntry: false, pipManage: false };
}

/**
 * 取当前视角可见的员工 id 集合（mock 模式）。
 * 真实模式由服务端按 tenant × role × 组织树/授权部门过滤，此函数不用于已接线页面。
 */
export function visibleEmployeeIds(
  role: string,
  selfEmployeeId?: string,
  anchorDeptId?: string,
): Set<string> {
  const meta = resolveRoleMeta(role);
  if (meta.scope === 'SELF') {
    return new Set(selfEmployeeId ? [selfEmployeeId] : []);
  }
  if (meta.scope === 'SUBTREE' && anchorDeptId) {
    const deptIds = subtreeDeptIds(anchorDeptId);
    return new Set(
      employees.filter((e) => deptIds.includes(e.deptId)).map((e) => e.id),
    );
  }
  if (meta.scope === 'ASSIGNED_DEPTS') {
    // mock 无真实授权部门数据：有锚点部门时按其子树，否则放行全员。
    // 真实模式由服务端按 roles.users/{id}/scopes 配置的部门过滤。
    if (anchorDeptId) {
      const deptIds = subtreeDeptIds(anchorDeptId);
      return new Set(
        employees.filter((e) => deptIds.includes(e.deptId)).map((e) => e.id),
      );
    }
    return new Set(employees.map((e) => e.id));
  }
  if (meta.scope === 'RELATED') {
    // 原型简化：认证小组可见研发中心全部评审对象
    return new Set(
      employees.filter((e) => e.deptId.startsWith('3')).map((e) => e.id),
    );
  }
  if (meta.scope === 'PLATFORM') {
    // 平台管理员不可见员工明文
    return new Set();
  }
  // GLOBAL：全部员工
  return new Set(employees.map((e) => e.id));
}

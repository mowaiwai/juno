import type { DataScope, RoleCode } from '@/types';
import { employees } from '@/mock/people';
import { subtreeDeptIds } from '@/mock/org';

export interface RoleMeta {
  label: string;
  scope: DataScope;
  /** 可见的敏感字段 */
  seeSalary: boolean;
  seeFullProfile: boolean;
  description: string;
}

export const ROLE_META: Record<RoleCode, RoleMeta> = {
  employee: {
    label: '员工',
    scope: 'SELF',
    seeSalary: false,
    seeFullProfile: false,
    description: '仅本人数据：画像、通道、IDP、认证',
  },
  manager: {
    label: '管理者',
    scope: 'DEPT_SUBTREE',
    seeSalary: false,
    seeFullProfile: true,
    description: '所辖组织子树：团队画像、差距、审批',
  },
  cert_panel: {
    label: '认证小组',
    scope: 'RELATED',
    seeSalary: false,
    seeFullProfile: true,
    description: '被评审对象材料：只评审、不落库',
  },
  committee: {
    label: '管委会',
    scope: 'ALL_TENANT',
    seeSalary: true,
    seeFullProfile: true,
    description: '高等级认证终审，可看薪酬',
  },
  hr: {
    label: 'HR',
    scope: 'ALL_TENANT',
    seeSalary: true,
    seeFullProfile: true,
    description: '全公司：标准、流程、盘点、薪酬',
  },
  exec: {
    label: '高管',
    scope: 'ALL_TENANT',
    seeSalary: true,
    seeFullProfile: true,
    description: '全量：三张图、审批、人才决策',
  },
  tenant_admin: {
    label: '租户管理员',
    scope: 'ALL_TENANT',
    seeSalary: false,
    seeFullProfile: false,
    description: '本租户配置、模板、用量与导出',
  },
  platform_admin: {
    label: '平台管理员',
    scope: 'PLATFORM',
    seeSalary: false,
    seeFullProfile: false,
    description: '平台级：租户与账单，不可见员工明文',
  },
};

/** 取当前视角可见的员工 id 集合（真实实现由服务端推导） */
export function visibleEmployeeIds(
  role: RoleCode,
  selfEmployeeId?: string,
  anchorDeptId?: string,
): Set<string> {
  const meta = ROLE_META[role];
  if (meta.scope === 'SELF') {
    return new Set(selfEmployeeId ? [selfEmployeeId] : []);
  }
  if (meta.scope === 'DEPT_SUBTREE' && anchorDeptId) {
    const deptIds = subtreeDeptIds(anchorDeptId);
    return new Set(
      employees.filter((e) => deptIds.includes(e.deptId)).map((e) => e.id),
    );
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
  return new Set(employees.map((e) => e.id));
}

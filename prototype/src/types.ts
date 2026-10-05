/**
 * 前端角色标识：
 * - 内置角色直接用后端 ref（reviewer/lead_reviewer 在 API 层合并映射为 cert_panel）；
 * - 单一 hr 已按 RBAC 三支柱拆为 5 个 COE 角色 + hrbp + ssc；
 * - 租户自定义角色 ref 形如 `custom:<uuid>`，原样透传。
 */
export type RoleCode =
  | 'employee'
  | 'manager'
  | 'cert_panel'
  | 'committee'
  | 'exec'
  | 'tenant_admin'
  | 'platform_admin'
  // HR 三支柱 · COE
  | 'hr_coe_cadre'
  | 'hr_coe_perf'
  | 'hr_coe_comp'
  | 'hr_coe_recruit'
  | 'hr_coe_otd'
  // HR 三支柱 · BP / SSC
  | 'hrbp'
  | 'ssc'
  // 租户自定义角色
  | `custom:${string}`;

/** 内置角色 ref（不含 custom: 前缀的自定义角色） */
export type BuiltinRoleCode = Exclude<RoleCode, `custom:${string}`>;

/**
 * 数据范围（与后端 scope_type 对齐）：
 * RELATED 为 cert_panel 合并视角的额外语义（被分配的评审对象）。
 */
export type DataScope =
  | 'SELF'
  | 'SUBTREE'
  | 'ASSIGNED_DEPTS'
  | 'GLOBAL'
  | 'PLATFORM'
  | 'RELATED';

export type Family = 'P' | 'T' | 'M' | 'O' | 'S';

export type Potential = 'HIGH' | 'MID' | 'LOW';
export type RiskLevel = 'HIGH' | 'MID' | 'LOW';

export interface Department {
  id: string;
  parentId: string;
  name: string;
  managerId?: string;
  type: 'func' | 'biz' | 'tech';
}

export interface Position {
  id: string;
  name: string;
  deptId: string;
  family: Family;
  sequence: string;
  grade: string;
  isCore: boolean;
  headcount: number;
}

export interface Employee {
  id: string;
  name: string;
  deptId: string;
  position: string;
  family: Family;
  sequence: string;
  grade: string;
  years: number;
  /** 2025 年度绩效 */
  perf: 'S' | 'A' | 'B' | 'C' | 'D';
  perfScore: number;
  potential: Potential;
  /** 九宫格定位 9{col}{row} */
  grid: string;
  salary: number;
  isCorePosition: boolean;
  risk: RiskLevel;
  tags: string[];
}

/** 角色切换器/授角展示用的角色引用 */
export interface RoleRef {
  /** 角色 ref：内置角色名或 custom:<uuid> */
  ref: string;
  /** 角色名称（内置为后端展示名，自定义为租户命名） */
  label: string;
  /** 后端 scope_type：self/subtree/assigned_depts/global */
  scope_type: string;
}

export interface Persona {
  id: string;
  employeeId?: string;
  name: string;
  title: string;
  roles: RoleCode[];
  /** /me.role_refs 全量角色引用（custom 角色靠它在切换器显示名称） */
  roleRefs: RoleRef[];
  defaultRole: RoleCode;
  tenantId: string;
  tenantName: string;
  blurb: string;
  family?: string;
  grade?: string;
}

export interface StandardSummary {
  id: string;
  sequence: string;
  sequenceName: string;
  grades: number;
  duties: number;
  knowledges: number;
  abilities: number;
  version: string;
  status: '生效' | '草稿' | '评审中';
  updatedAt: string;
}

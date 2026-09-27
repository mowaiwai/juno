export type RoleCode =
  | 'employee'
  | 'manager'
  | 'cert_panel'
  | 'committee'
  | 'hr'
  | 'exec'
  | 'tenant_admin'
  | 'platform_admin';

export type DataScope =
  | 'SELF'
  | 'DEPT_SUBTREE'
  | 'RELATED'
  | 'ALL_TENANT'
  | 'PLATFORM';

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

export interface Persona {
  id: string;
  employeeId?: string;
  name: string;
  title: string;
  roles: RoleCode[];
  defaultRole: RoleCode;
  tenantId: string;
  tenantName: string;
  blurb: string;
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

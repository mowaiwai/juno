import type { RoleCode } from '@/types';
import { api } from './client';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

/** /me 返回的单个角色引用 */
export interface MeRoleRef {
  /** 角色 ref：内置角色名或 custom:<uuid> */
  ref: string;
  name: string;
  kind: 'builtin' | 'custom';
  scope_type: 'self' | 'subtree' | 'assigned_depts' | 'global';
  active: boolean;
}

export interface MeResponse {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  /** 当前激活角色 ref（服务端强制单一激活角色） */
  active_role_ref: string | null;
  active_role_name: string | null;
  /** 用户持有的全部角色 */
  role_refs: MeRoleRef[];
  /** 员工档案 id（非 User id），无员工档案时为 null */
  employee_id: string | null;
  family: string | null;
  grade: string | null;
}

/**
 * 后端内置角色 → 原型 RoleCode 映射。
 * - HR 已拆为 7 个角色，ref 同名直通；
 * - reviewer/lead_reviewer 合并为 cert_panel 视角（权限由后端区分）；
 * - custom:<uuid> 不在此表，由调用方原样保留。
 */
export const BACKEND_ROLE_MAP: Record<string, RoleCode> = {
  employee: 'employee',
  manager: 'manager',
  // MVP 简化：评委与评审组长合并为「认证小组」视角，权限由后端区分
  reviewer: 'cert_panel',
  lead_reviewer: 'cert_panel',
  exec: 'exec',
  committee: 'committee',
  tenant_admin: 'tenant_admin',
  platform_admin: 'platform_admin',
  // HR 三支柱 · COE
  hr_coe_cadre: 'hr_coe_cadre',
  hr_coe_perf: 'hr_coe_perf',
  hr_coe_comp: 'hr_coe_comp',
  hr_coe_recruit: 'hr_coe_recruit',
  hr_coe_otd: 'hr_coe_otd',
  // HR 三支柱 · BP / SSC
  hrbp: 'hrbp',
  ssc: 'ssc',
};

/** 后端角色 ref → 前端角色标识：内置映射，custom: 原样保留，其余返回 null */
export function mapBackendRole(ref: string): RoleCode | null {
  if (ref.startsWith('custom:')) return ref as RoleCode;
  return BACKEND_ROLE_MAP[ref] ?? null;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  me: () => api.get<MeResponse>('/me'),
};

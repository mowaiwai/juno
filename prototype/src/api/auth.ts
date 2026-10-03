import type { RoleCode } from '@/types';
import { api } from './client';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface MeResponse {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  /** 主角色（后端角色小写值），登录默认视角 */
  role: string;
  /** 全量角色集（后端角色小写值），用于多角色视角切换 */
  roles: string[];
  /** 员工档案 id（非 User id），无员工档案时为 null */
  employee_id: string | null;
  family: string | null;
  grade: string | null;
}

/** 后端角色 → 原型 RoleCode 映射 */
export const BACKEND_ROLE_MAP: Record<string, RoleCode> = {
  employee: 'employee',
  manager: 'manager',
  // MVP 简化：评委与评审组长合并为「认证小组」视角，权限由后端区分
  reviewer: 'cert_panel',
  lead_reviewer: 'cert_panel',
  hr: 'hr',
  exec: 'exec',
  committee: 'committee',
  tenant_admin: 'tenant_admin',
  platform_admin: 'platform_admin',
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  me: () => api.get<MeResponse>('/me'),
};

/**
 * RBAC 角色与权限接口：角色目录、自定义角色、用户授角与数据范围。
 * 契约 base：/api/v1
 */
import { api } from './client';

export type ScopeType = 'self' | 'subtree' | 'assigned_depts' | 'global';

/** 权限点目录分组 */
export interface PermissionGroup {
  code: string;
  title: string;
  points: { code: string; label: string }[];
}

/** 内置角色模板 */
export interface BuiltinRole {
  ref: string;
  name: string;
  scope_type: ScopeType;
  cloneable: boolean;
  permissions: string[];
}

export interface RoleCatalog {
  groups: PermissionGroup[];
  builtin_roles: BuiltinRole[];
  cloneable: string[];
  scope_types: string[];
}

/** 自定义角色 */
export interface CustomRole {
  id: string;
  /** 角色 ref，形如 custom:<uuid> */
  ref: string;
  name: string;
  scope_type: ScopeType;
  permissions: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomRoleInput {
  name: string;
  scope_type: ScopeType;
  permissions: string[];
}

/** /users 用户列表项 */
export interface UserListItem {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  active_role_ref: string | null;
  role_refs: string[];
}

/** 用户的授角记录（GET /roles/users/{id}/grants） */
export interface UserGrant {
  ref: string;
  name: string;
  kind: 'builtin' | 'custom';
  scope_type: ScopeType;
  active: boolean;
}

/** 单角色的授权部门配置 */
export interface RoleScopeDept {
  dept_id: string;
  include_subtree: boolean;
}

/** 授权部门扁平行（后端 scopes/put-scopes 的实际形状） */
export interface UserScopeRow {
  role_ref: string;
  dept_id: string;
  include_subtree: boolean;
}

/** PUT /users/{id}/scopes 请求体 */
export interface RoleScopes {
  role_ref: string;
  depts: RoleScopeDept[];
}

/** GET /roles/users/{id}/grants 响应：授角引用、激活角色、授权部门三合一 */
export interface UserGrantsResponse {
  active_role_ref: string;
  role_refs: string[];
  scopes: UserScopeRow[];
}

export const rolesApi = {
  // ---------- 目录 ----------
  catalog: () => api.get<RoleCatalog>('/roles/catalog'),

  // ---------- 自定义角色 ----------
  listCustom: () => api.get<CustomRole[]>('/roles/custom'),
  createCustom: (input: CustomRoleInput) =>
    api.post<CustomRole>('/roles/custom', input),
  cloneBuiltin: (builtin_key: string, name?: string) =>
    api.post<CustomRole>('/roles/clone', { builtin_key, name }),
  updateCustom: (id: string, input: CustomRoleInput) =>
    api.put<CustomRole>(`/roles/custom/${encodeURIComponent(id)}`, input),
  deleteCustom: (id: string) =>
    api.delete<void>(`/roles/custom/${encodeURIComponent(id)}`),

  // ---------- 用户授角 ----------
  users: () => api.get<UserListItem[]>('/users'),
  grants: (userId: string) =>
    api.get<UserGrantsResponse>(
      `/roles/users/${encodeURIComponent(userId)}/grants`,
    ),
  grant: (userId: string, ref: string) =>
    api.post<void>(`/roles/users/${encodeURIComponent(userId)}/grants`, { ref }),
  revoke: (userId: string, ref: string) =>
    api.delete<void>(
      `/roles/users/${encodeURIComponent(userId)}/grants/${encodeURIComponent(ref)}`,
    ),
  setActiveRole: (userId: string, ref: string) =>
    api.put<void>(
      `/roles/users/${encodeURIComponent(userId)}/active-role`,
      { ref },
    ),

  // ---------- 数据范围（ASSIGNED_DEPTS 角色的授权部门） ----------
  // 注意：后端没有 GET /scopes，授权部门随 GET /grants 的 scopes 字段一并返回
  setScopes: (userId: string, body: RoleScopes) =>
    api.put<UserScopeRow[]>(
      `/roles/users/${encodeURIComponent(userId)}/scopes`,
      body,
    ),
};

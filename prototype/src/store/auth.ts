import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Persona, RoleCode, RoleRef } from '@/types';
import { personas } from '@/mock/people';
import { employeeById } from '@/mock/people';
import { resolveRoleMeta, visibleEmployeeIds } from '@/auth/rbac';
import { USE_MOCK } from '@/api/config';
import { authApi, mapBackendRole, type MeResponse } from '@/api/auth';
import { rolesApi } from '@/api/roles';
import { setToken, setActiveRoleHeader } from '@/api/client';

interface AuthState {
  persona: Persona | null;
  /** 激活角色 ref（内置角色名或 custom:<uuid>） */
  activeRole: string | null;
  /** mock：personaId；真实：邮箱+密码 */
  login: (idOrEmail: string, passwordOrRole?: string) => Promise<void>;
  logout: () => void;
  /** mock 模式仅本地切换；真实模式乐观切换并持久化到服务端，失败回滚并抛错 */
  switchRole: (role: string) => Promise<void>;
  /** 应用启动：真实模式下有 token 则恢复会话 */
  bootstrap: () => Promise<void>;
}

/** /me → Persona：基于 role_refs 构建角色列表（去重，custom: 原样保留） */
function personaFromMe(me: MeResponse): Persona {
  const roleRefs: RoleRef[] = (me.role_refs ?? []).map((r) => ({
    ref: r.ref,
    label: r.name,
    scope_type: r.scope_type,
  }));

  const mapped: RoleCode[] = roleRefs
    .map((r) => mapBackendRole(r.ref))
    .filter((r): r is RoleCode => !!r);
  const roles = [...new Set<RoleCode>(mapped)];

  const activeRef =
    me.role_refs?.find((r) => r.active)?.ref ?? me.active_role_ref ?? null;
  const activeMapped = activeRef ? mapBackendRole(activeRef) : null;
  const defaultRole: RoleCode =
    activeMapped ?? roles[0] ?? 'employee';

  return {
    id: me.id,
    employeeId: me.employee_id ?? me.id,
    name: me.name,
    title: resolveRoleMeta(defaultRole, roleRefs).label,
    roles,
    roleRefs,
    defaultRole,
    tenantId: me.tenant_id,
    tenantName: '',
    blurb: '',
    family: me.family ?? undefined,
    grade: me.grade ?? undefined,
  };
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      persona: null,
      activeRole: null,
      login: async (idOrEmail, passwordOrRole) => {
        if (USE_MOCK) {
          const persona = personas.find((p) => p.id === idOrEmail) ?? null;
          if (persona) {
            const active = passwordOrRole ?? persona.defaultRole;
            setActiveRoleHeader(active);
            set({ persona, activeRole: active });
          }
          return;
        }
        const { access_token } = await authApi.login(
          idOrEmail,
          passwordOrRole ?? '',
        );
        setToken(access_token);
        const me = await authApi.me();
        const persona = personaFromMe(me);
        setActiveRoleHeader(persona.defaultRole);
        set({ persona, activeRole: persona.defaultRole });
      },
      logout: () => {
        setToken(null);
        setActiveRoleHeader(null);
        set({ persona: null, activeRole: null });
      },
      switchRole: async (role) => {
        const { persona, activeRole } = get();
        if (!persona || !persona.roles.includes(role as RoleCode) || activeRole === role) {
          return;
        }
        // mock 模式：仅本地切换
        if (USE_MOCK) {
          setActiveRoleHeader(role);
          set({ activeRole: role });
          return;
        }
        // 真实模式：乐观切换，失败回滚并抛错
        const previous = activeRole;
        setActiveRoleHeader(role);
        set({ activeRole: role });
        try {
          await rolesApi.setActiveRole(persona.id, role);
        } catch (e) {
          setActiveRoleHeader(previous);
          set({ activeRole: previous });
          throw e;
        }
      },
      bootstrap: async () => {
        if (USE_MOCK) return;
        try {
          const me = await authApi.me();
          const persona = personaFromMe(me);
          setActiveRoleHeader(persona.defaultRole);
          set({ persona, activeRole: persona.defaultRole });
        } catch {
          setToken(null);
          setActiveRoleHeader(null);
          set({ persona: null, activeRole: null });
        }
      },
    }),
    {
      name: 'hr-prototype-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) =>
        USE_MOCK
          ? {
              persona: s.persona ? { id: s.persona.id } : null,
              activeRole: s.activeRole,
            }
          : // 真实模式：会话由 token(bootstrap) 恢复，不持久化 persona
            { persona: null, activeRole: null },
      // mock：持久化 personaId，merge 时还原完整 persona
      merge: (persisted, current) => {
        if (!USE_MOCK) return current;
        const saved = (persisted ?? {}) as Partial<AuthState> & {
          persona?: { id?: string } | null;
        };
        const pid = saved.persona?.id;
        const persona = pid ? personas.find((p) => p.id === pid) ?? null : null;
        // 还原会话后同步激活角色到请求头模块（须仍是该 persona 持有角色）
        const activeRole =
          saved.activeRole &&
          persona?.roles.includes(saved.activeRole as RoleCode)
            ? saved.activeRole
            : persona?.defaultRole ?? null;
        if (activeRole) setActiveRoleHeader(activeRole);
        return {
          ...current,
          ...saved,
          persona,
          activeRole,
        };
      },
    },
  ),
);

/** 当前激活角色的元信息（custom 角色用 persona.roleRefs 中的名称兜底） */
export function useActiveRoleMeta() {
  const role = useAuth((s) => s.activeRole);
  const roleRefs = useAuth((s) => s.persona?.roleRefs);
  return role ? resolveRoleMeta(role, roleRefs) : null;
}

/**
 * 数据范围原语（mock 模式）：按当前视角过滤员工类列表。
 * 真实模式由服务端按 tenant × role × 组织树过滤，此函数不再用于已接线页面。
 */
export function useDataScope() {
  const persona = useAuth((s) => s.persona);
  const role = useAuth((s) => s.activeRole);

  return <T extends { id: string } | { employeeId: string }>(
    list: T[],
  ): T[] => {
    if (!persona || !role) return [];
    if (resolveRoleMeta(role, persona.roleRefs).scope === 'PLATFORM') return [];
    const self = employeeById(persona.employeeId);
    const ids = visibleEmployeeIds(role, persona.employeeId, self?.deptId);
    return list.filter((item) => {
      const key = 'employeeId' in item ? item.employeeId : item.id;
      return ids.has(key);
    });
  };
}

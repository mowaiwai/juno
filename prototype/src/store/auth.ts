import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Persona, RoleCode } from '@/types';
import { personas } from '@/mock/people';
import { employeeById } from '@/mock/people';
import { ROLE_META, visibleEmployeeIds } from '@/auth/rbac';
import { USE_MOCK } from '@/api/config';
import { authApi, BACKEND_ROLE_MAP, type MeResponse } from '@/api/auth';
import { setToken } from '@/api/client';

interface AuthState {
  persona: Persona | null;
  activeRole: RoleCode | null;
  /** mock：personaId；真实：邮箱+密码 */
  login: (idOrEmail: string, passwordOrRole?: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: RoleCode) => void;
  /** 应用启动：真实模式下有 token 则恢复会话 */
  bootstrap: () => Promise<void>;
}

function personaFromMe(me: MeResponse): Persona {
  const defaultRole = BACKEND_ROLE_MAP[me.role] ?? 'employee';
  // 全量角色集 → 前端 RoleCode，去重；映射不到的后端角色（如 exec 无对应）跳过
  const mapped = (me.roles ?? [me.role])
    .map((r) => BACKEND_ROLE_MAP[r])
    .filter((r): r is RoleCode => !!r);
  const roles = [...new Set<RoleCode>([defaultRole, ...mapped])];
  return {
    id: me.id,
    employeeId: me.employee_id ?? me.id,
    name: me.name,
    title: ROLE_META[defaultRole].label,
    roles,
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
    (set) => ({
      persona: null,
      activeRole: null,
      login: async (idOrEmail, passwordOrRole) => {
        if (USE_MOCK) {
          const persona = personas.find((p) => p.id === idOrEmail) ?? null;
          if (persona) {
            set({ persona, activeRole: passwordOrRole as RoleCode ?? persona.defaultRole });
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
        set({ persona, activeRole: persona.defaultRole });
      },
      logout: () => {
        setToken(null);
        set({ persona: null, activeRole: null });
      },
      switchRole: (role) =>
        set((s) =>
          s.persona && s.persona.roles.includes(role)
            ? { activeRole: role }
            : s,
        ),
      bootstrap: async () => {
        if (USE_MOCK) return;
        try {
          const me = await authApi.me();
          const persona = personaFromMe(me);
          set({ persona, activeRole: persona.defaultRole });
        } catch {
          setToken(null);
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
        return {
          ...current,
          ...saved,
          persona: pid ? personas.find((p) => p.id === pid) ?? null : null,
        };
      },
    },
  ),
);

/** 当前激活角色的元信息 */
export function useActiveRoleMeta() {
  const role = useAuth((s) => s.activeRole);
  return role ? ROLE_META[role] : null;
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
    if (ROLE_META[role].scope === 'PLATFORM') return [];
    const self = employeeById(persona.employeeId);
    const ids = visibleEmployeeIds(role, persona.employeeId, self?.deptId);
    return list.filter((item) => {
      const key = 'employeeId' in item ? item.employeeId : item.id;
      return ids.has(key);
    });
  };
}

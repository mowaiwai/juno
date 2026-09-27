import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Persona, RoleCode } from '@/types';
import { personas } from '@/mock/people';
import { employeeById } from '@/mock/people';
import { ROLE_META, visibleEmployeeIds } from '@/auth/rbac';

interface AuthState {
  persona: Persona | null;
  activeRole: RoleCode | null;
  login: (personaId: string, role?: RoleCode) => void;
  logout: () => void;
  switchRole: (role: RoleCode) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      persona: null,
      activeRole: null,
      login: (personaId, role) => {
        const persona = personas.find((p) => p.id === personaId) ?? null;
        if (persona) {
          set({ persona, activeRole: role ?? persona.defaultRole });
        }
      },
      logout: () => set({ persona: null, activeRole: null }),
      switchRole: (role) =>
        set((s) =>
          s.persona && s.persona.roles.includes(role)
            ? { activeRole: role }
            : s,
        ),
    }),
    {
      name: 'hr-prototype-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        persona: s.persona
          ? { id: s.persona.id }
          : null,
        activeRole: s.activeRole,
      }),
      // 持久化的只是 personaId，merge 时还原为完整 persona
      merge: (persisted, current) => {
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
 * 数据范围原语：按当前视角过滤员工类列表。
 * 真实系统由服务端按 tenant × role × 组织树过滤。
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

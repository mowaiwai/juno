/** IDP 个人发展计划接口。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { idpList } from '@/mock/gap';

export interface IDPGoal {
  ability: string;
  target: string;
}

export interface IDPKeyBehavior {
  behavior: string;
  plan: string;
  status: 'done' | 'doing' | 'todo';
}

export interface IDPOut {
  id: string;
  tenant_id: string;
  employee_id: string;
  period: string;
  period_type: number;
  status: string;
  goals: IDPGoal[];
  key_behaviors: IDPKeyBehavior[];
  review_result: string | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface IDPCreateIn {
  employee_id: string;
  period: string;
  period_type?: number;
  goals?: IDPGoal[];
  key_behaviors?: IDPKeyBehavior[];
}

export interface IDPUpdateIn {
  goals?: IDPGoal[];
  key_behaviors?: IDPKeyBehavior[];
}

export interface IDPGenerateIn {
  employee_id: string;
  period: string;
  period_type?: number;
}

export const IDP_STATUS_LABEL_MAP: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
  reviewing: '复盘中',
  closed: '已归档',
};

const mockToOut = (m: typeof idpList[0]): IDPOut => ({
  id: m.id,
  tenant_id: 'mock',
  employee_id: m.employeeId,
  period: m.period,
  period_type: m.periodType,
  status: m.status,
  goals: m.goals,
  key_behaviors: m.keyBehaviors,
  review_result: m.reviewResult ?? null,
  created_by: 'mock',
  reviewed_by: null,
  reviewed_at: null,
});

export const idpApi = {
  list: (employeeId?: string): Promise<IDPOut[]> => {
    if (USE_MOCK) {
      const filtered = employeeId
        ? idpList.filter((i) => i.employeeId === employeeId)
        : idpList;
      return Promise.resolve(filtered.map(mockToOut));
    }
    const path = employeeId ? `/idps?employee_id=${employeeId}` : '/idps';
    return api.get<IDPOut[]>(path);
  },

  get: (idpId: string): Promise<IDPOut> => {
    if (USE_MOCK) {
      const found = idpList.find((i) => i.id === idpId);
      return Promise.resolve(found ? mockToOut(found) : Promise.reject(new Error('not found')));
    }
    return api.get<IDPOut>(`/idps/${idpId}`);
  },

  create: (body: IDPCreateIn): Promise<IDPOut> => {
    if (USE_MOCK) {
      const m = {
        id: `idp_mock_${Date.now()}`,
        employeeId: body.employee_id,
        period: body.period,
        periodType: (body.period_type ?? 1) as 1 | 2,
        status: 'draft' as const,
        goals: body.goals ?? [],
        keyBehaviors: body.key_behaviors ?? [],
      };
      idpList.push(m);
      return Promise.resolve(mockToOut(m));
    }
    return api.post<IDPOut>('/idps', body);
  },

  update: (idpId: string, body: IDPUpdateIn): Promise<IDPOut> => {
    if (USE_MOCK) {
      const m = idpList.find((i) => i.id === idpId);
      if (!m) return Promise.reject(new Error('not found'));
      if (body.goals) m.goals = body.goals;
      if (body.key_behaviors) m.keyBehaviors = body.key_behaviors;
      return Promise.resolve(mockToOut(m));
    }
    return api.put<IDPOut>(`/idps/${idpId}`, body);
  },

  updateKeyBehavior: (idpId: string, behavior: string, plan: string, status: string): Promise<IDPOut> => {
    if (USE_MOCK) {
      const m = idpList.find((i) => i.id === idpId);
      if (!m) return Promise.reject(new Error('not found'));
      const kb = m.keyBehaviors.find((k) => k.behavior === behavior);
      if (kb) { kb.status = status as 'done' | 'doing' | 'todo'; kb.plan = plan; }
      return Promise.resolve(mockToOut(m));
    }
    return api.put<IDPOut>(`/idps/${idpId}/key-behaviors`, { behavior, plan, status });
  },

  confirm: (idpId: string): Promise<IDPOut> => {
    if (USE_MOCK) {
      const m = idpList.find((i) => i.id === idpId);
      if (m) m.status = 'confirmed';
      return Promise.resolve(m ? mockToOut(m) : Promise.reject(new Error('not found')));
    }
    return api.post<IDPOut>(`/idps/${idpId}/confirm`, {});
  },

  submitReview: (idpId: string, reviewResult: string): Promise<IDPOut> => {
    if (USE_MOCK) {
      const m = idpList.find((i) => i.id === idpId);
      if (m) { m.status = 'reviewing'; m.reviewResult = reviewResult; }
      return Promise.resolve(m ? mockToOut(m) : Promise.reject(new Error('not found')));
    }
    return api.post<IDPOut>(`/idps/${idpId}/review`, { review_result: reviewResult });
  },

  close: (idpId: string): Promise<IDPOut> => {
    if (USE_MOCK) {
      const m = idpList.find((i) => i.id === idpId);
      if (m) m.status = 'closed';
      return Promise.resolve(m ? mockToOut(m) : Promise.reject(new Error('not found')));
    }
    return api.post<IDPOut>(`/idps/${idpId}/close`, {});
  },

  generate: (body: IDPGenerateIn): Promise<IDPOut> => {
    if (USE_MOCK) {
      const m = {
        id: `idp_mock_${Date.now()}`,
        employeeId: body.employee_id,
        period: body.period,
        periodType: (body.period_type ?? 1) as 1 | 2,
        status: 'draft' as const,
        goals: [{ ability: '综合发展', target: '基于画像差距自动生成' }],
        keyBehaviors: [{ behavior: '持续学习与复盘', plan: '按月度与上级复盘进展', status: 'todo' as const }],
      };
      idpList.push(m);
      return Promise.resolve(mockToOut(m));
    }
    return api.post<IDPOut>('/idps/generate', body);
  },
};

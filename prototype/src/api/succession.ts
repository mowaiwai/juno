/** 核心岗位 / 继任 / 梯队池接口（spec talent-matching §5.3）。 */
import { api } from './client';
import { USE_MOCK } from './config';
import {
  corePositions as mockCorePositions,
  successionCandidates,
  poolMembers as mockPoolMembers,
} from '@/mock/succession';

export interface CorePositionView {
  id: string;
  name: string;
  dept_id: string | null;
  sequence: string;
  grade: string;
  headcount: number;
  incumbent_employee_id: string | null;
  created_by: string;
  created_at: string;
  risk: string;
  risk_reason: string;
  coverage: number;
  candidate_count: number;
  candidates: CandidateOut[];
}

export interface CandidateOut {
  id: string;
  core_position_id: string;
  employee_id: string;
  origin: string;
  willingness: string;
  perf_label: string | null;
  duty_score: number | null;
}

export interface TalentPoolOut {
  id: string;
  tenant_id: string;
  employee_id: string;
  pool_level: string;
  reason: string;
  joined_by: string;
  joined_at: string;
  status: string;
}

const MOCK_USER = 'E10002';

function mockPositionToView(p: ReturnType<typeof mockCorePositions>[number]): CorePositionView {
  const cands = successionCandidates(p.id);
  return {
    id: p.id,
    name: p.name,
    dept_id: p.deptName,
    sequence: '',
    grade: p.grade,
    headcount: p.headcount,
    incumbent_employee_id: p.incumbentId ?? null,
    created_by: MOCK_USER,
    created_at: '2026-09-01',
    risk: p.risk,
    risk_reason: p.riskReason,
    coverage: Math.round(p.coverage * 100),
    candidate_count: cands.length,
    candidates: cands.map((c) => ({
      id: `${p.id}-${c.employeeId}`,
      core_position_id: p.id,
      employee_id: c.employeeId,
      origin: 'auto',
      willingness: c.willingness,
      perf_label: null,
      duty_score: null,
    })),
  };
}

function mockPoolToDTO(p: typeof mockPoolMembers[number]): TalentPoolOut {
  return {
    id: `pool-${p.employeeId}-${p.level}`,
    tenant_id: 'mock',
    employee_id: p.employeeId,
    pool_level: p.level,
    reason: p.reason,
    joined_by: MOCK_USER,
    joined_at: p.joinedAt,
    status: p.status,
  };
}

export const successionApi = {
  listPositions: () => {
    if (USE_MOCK) return Promise.resolve(mockCorePositions().map(mockPositionToView));
    return api.get<CorePositionView[]>('/core-positions');
  },
  getPosition: (positionId: string) => {
    if (USE_MOCK) {
      const p = mockCorePositions().find((x) => x.id === positionId);
      if (!p) return Promise.reject(new Error('not found'));
      return Promise.resolve(mockPositionToView(p));
    }
    return api.get<CorePositionView>(`/core-positions/${positionId}`);
  },
  createPosition: (body: {
    name: string; grade: string; sequence: string;
    headcount?: number; dept_id?: string | null;
    incumbent_employee_id?: string | null;
  }) => {
    if (USE_MOCK) return Promise.resolve({} as CorePositionView);
    return api.post<CorePositionView>('/core-positions', body);
  },
  updatePosition: (positionId: string, body: Record<string, unknown>) => {
    if (USE_MOCK) return Promise.resolve({} as CorePositionView);
    return api.put<CorePositionView>(`/core-positions/${positionId}`, body);
  },
  deletePosition: (positionId: string) => {
    if (USE_MOCK) return Promise.resolve(undefined);
    return api.delete<void>(`/core-positions/${positionId}`);
  },
  autoScreen: (positionId: string) => {
    if (USE_MOCK) {
      const p = mockCorePositions().find((x) => x.id === positionId);
      return Promise.resolve(mockPositionToView(p!));
    }
    return api.post<CorePositionView>(`/core-positions/${positionId}/auto-screen`);
  },
  listCandidates: (positionId: string) => {
    if (USE_MOCK) {
      const p = mockCorePositions().find((x) => x.id === positionId);
      const cands = p ? successionCandidates(p.id) : [];
      return Promise.resolve(
        cands.map((c) => ({
          id: `${positionId}-${c.employeeId}`,
          core_position_id: positionId,
          employee_id: c.employeeId,
          origin: 'auto',
          willingness: c.willingness,
          perf_label: null,
          duty_score: null,
        })),
      );
    }
    return api.get<CandidateOut[]>(`/core-positions/${positionId}/candidates`);
  },
  nominate: (positionId: string, employee_id: string) => {
    if (USE_MOCK) return Promise.resolve({} as CandidateOut);
    return api.post<CandidateOut>(`/core-positions/${positionId}/candidates`, { employee_id });
  },
  removeCandidate: (positionId: string, employee_id: string) => {
    if (USE_MOCK) return Promise.resolve(undefined);
    return api.delete<void>(`/core-positions/${positionId}/candidates`, { employee_id });
  },
  setWillingness: (positionId: string, employeeId: string, willingness: string) => {
    if (USE_MOCK) return Promise.resolve({} as CandidateOut);
    return api.put<CandidateOut>(
      `/core-positions/${positionId}/candidates/${employeeId}/willingness`,
      { willingness },
    );
  },
  listPools: () => {
    if (USE_MOCK) return Promise.resolve(mockPoolMembers.map(mockPoolToDTO));
    return api.get<TalentPoolOut[]>('/talent-pools');
  },
  joinPool: (body: { employee_id: string; pool_level: string; reason: string }) => {
    if (USE_MOCK) return Promise.resolve({} as TalentPoolOut);
    return api.post<TalentPoolOut>('/talent-pools', body);
  },
  updatePool: (poolId: string, body: Record<string, unknown>) => {
    if (USE_MOCK) return Promise.resolve({} as TalentPoolOut);
    return api.put<TalentPoolOut>(`/talent-pools/${poolId}`, body);
  },
};

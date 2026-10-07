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
  /** 模块六 P3：统一匹配引擎就绪度（无画像 → null，不造分） */
  match_score?: number | null;
  readiness?: string | null;
}

/** 就绪度三档（PRD 模块六 P3）：Ready Now→P-L1、1–2 年→P-L2、3 年+→P-L3 */
export const READINESS_META: Record<string, { label: string; color: string }> = {
  ready_now: { label: 'Ready Now', color: 'var(--sage)' },
  ready_1_2y: { label: '1–2 年', color: 'var(--ochre)' },
  ready_3y: { label: '3 年+', color: 'var(--sky)' },
  unassessed: { label: '暂无画像', color: 'var(--ink-4)' },
};

export interface RecommendationOut {
  employee_id: string;
  name: string;
  position: string | null;
  grade: string | null;
  perf_grade: string | null;
  match_score: number;
  readiness: string;
  readiness_label: string;
  level: string;
  reason: string;
  missing_dims: string[];
  willingness: string;
  in_pool: boolean;
}

export interface MapPositionOut {
  position_id: string;
  name: string;
  dept_name: string | null;
  sequence: string;
  grade: string;
  headcount: number;
  incumbent_name: string | null;
  ready_now: number;
  ready_1_2y: number;
  ready_3y: number;
  unassessed: number;
  candidate_count: number;
  coverage: number;
  risk: string;
}

export interface SuccessionMapOut {
  positions: MapPositionOut[];
  summary: {
    positions: number;
    ready_now_positions: number;
    no_backup_positions: number;
    vacant_positions: number;
  };
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
      match_score: c.matchScore,
      readiness:
        c.readiness === 'ready' ? 'ready_now' : c.readiness === '2y' ? 'ready_3y' : 'ready_1_2y',
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
          match_score: c.matchScore,
          readiness:
            c.readiness === 'ready' ? 'ready_now' : c.readiness === '2y' ? 'ready_3y' : 'ready_1_2y',
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
  /** 单岗位继任推荐（统一匹配引擎 + 就绪度三档，按分排序） */
  recommendations: (positionId: string, limit = 10) => {
    if (USE_MOCK) {
      const p = mockCorePositions().find((x) => x.id === positionId);
      const cands = p ? successionCandidates(p.id) : [];
      return Promise.resolve(
        cands.slice(0, limit).map(
          (c): RecommendationOut => ({
            employee_id: c.employeeId,
            name: c.name,
            position: c.position,
            grade: null,
            perf_grade: null,
            match_score: c.matchScore,
            readiness:
              c.readiness === 'ready' ? 'ready_now' : c.readiness === '2y' ? 'ready_3y' : 'ready_1_2y',
            readiness_label: c.readiness === 'ready' ? 'Ready Now（核心继任）' : c.readiness === '2y' ? '3 年+潜力储备' : '1–2 年可继任',
            level: c.matchScore >= 80 ? 'good' : c.matchScore >= 60 ? 'watch' : 'mismatch',
            reason: c.matchSummary,
            missing_dims: [],
            willingness: c.willingness,
            in_pool: false,
          }),
        ),
      );
    }
    return api.get<RecommendationOut[]>(
      `/core-positions/${positionId}/recommendations?limit=${limit}`,
    );
  },
  /** 继任地图：核心岗位 × 就绪度分桶 */
  successionMap: (): Promise<SuccessionMapOut> => {
    if (USE_MOCK) {
      const positions = mockCorePositions().map((p) => {
        const cands = successionCandidates(p.id);
        const buckets = { ready_now: 0, ready_1_2y: 0, ready_3y: 0, unassessed: 0 };
        for (const c of cands) {
          if (c.readiness === 'ready') buckets.ready_now += 1;
          else if (c.readiness === '2y') buckets.ready_3y += 1;
          else buckets.ready_1_2y += 1;
        }
        return {
          position_id: p.id,
          name: p.name,
          dept_name: p.deptName,
          sequence: '',
          grade: p.grade,
          headcount: p.headcount,
          incumbent_name: p.incumbentName ?? null,
          ...buckets,
          candidate_count: cands.length,
          coverage: Math.round(p.coverage * 100),
          risk: p.risk,
        };
      });
      return Promise.resolve({
        positions,
        summary: {
          positions: positions.length,
          ready_now_positions: positions.filter((r) => r.ready_now > 0).length,
          no_backup_positions: positions.filter((r) => r.candidate_count === 0).length,
          vacant_positions: positions.filter((r) => !r.incumbent_name).length,
        },
      });
    }
    return api.get<SuccessionMapOut>('/succession/map');
  },
};

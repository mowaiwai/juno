/**
 * 绩效内生 API（P1）：方案→初评→校准→发布回写，PIP 与辅导。
 * 契约对齐 backend/app/schemas/perf.py；mock 模式见 @/mock/perf。
 */
import { api } from './client';
import { USE_MOCK } from './config';
import { mockConstants, mockPerfApi } from '@/mock/perf';

// ============ 类型 ============

export type ToolType = 'pbc' | 'kpi' | 'okr' | '360';
export type PlanStatus = 'draft' | 'evaluating' | 'calibrating' | 'published';
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export type PipStatusValue = 'active' | 'passed' | 'failed';

export interface PerfConstants {
  score_cutoffs: Record<Grade | 'D', number>;
  coefficients: Partial<Record<Grade, number>>;
  c_divisor: number;
  distribution: Record<'S' | 'A' | 'B' | 'CD', [number, number]>;
  small_roster_threshold: number;
}

export type ConstantsUpdate = Partial<{
  score_cutoffs: Partial<Record<Grade, number>>;
  coefficients: Partial<Record<Grade, number>>;
  c_divisor: number;
  distribution: Partial<Record<'S' | 'A' | 'B' | 'CD', [number, number]>>;
  small_roster_threshold: number;
}>;

export interface PlanCreate {
  period: string;
  tool_type: ToolType;
  dept_ids: string[];
  sequence_codes: string[];
  exclude_ids?: string[];
}

export interface PlanUpdate {
  period?: string;
  tool_type?: ToolType;
  dept_ids?: string[];
  sequence_codes?: string[];
}

export interface PlanTransition {
  to: 'evaluating' | 'calibrating';
}

export interface RosterMember {
  id: string;
  employee_no: string;
  name: string;
  dept_id: string;
  position: string;
  sequence: string;
}

export interface PlanOut {
  id: string;
  period: string;
  tool_type: ToolType;
  status: PlanStatus;
  scope_depts: string[];
  scope_sequences: string[];
  roster_members: RosterMember[];
  excluded_members: RosterMember[];
  distribution_override_reason: string | null;
  published_at: string | null;
  result_count: number;
}

export interface PlanSummary {
  id: string;
  period: string;
  tool_type: ToolType;
  status: PlanStatus;
  roster_size: number;
  result_count: number;
  published_at: string | null;
}

export interface ResultItemIn {
  employee_id: string;
  grade: Grade;
  score: number | null;
  evidence: string[];
}

export interface ResultOut {
  plan_id: string;
  employee_id: string;
  employee_no: string;
  name: string;
  grade: Grade;
  score: number | null;
  coefficient: number;
  org_coefficient: number;
  evidence: string[];
}

export interface DistributionViolation {
  bucket: string;
  ratio: number;
  low: number;
  high: number;
}

export interface UngradedMember {
  employee_id: string;
  employee_no: string;
  name: string;
}

export interface DistributionOut {
  roster_size: number;
  graded_count: number;
  counts: Record<Grade, number>;
  ratios: Record<Grade, number>;
  cd_ratio: number;
  ungraded: UngradedMember[];
  violations: DistributionViolation[];
  small_roster: boolean;
}

export interface PlanImportIn {
  items: Array<{
    employee_no: string;
    grade: Grade;
    score?: number | null;
  }>;
}

export interface PlanImportOut {
  imported: number;
  errors: Array<{ employee_no: string; reason: string }>;
}

export interface PipCreate {
  employee_id: string;
  period: string;
  goals?: string[];
  deadline?: string | null;
  perf_result_id?: string | null;
}

export interface PipUpdate {
  goals?: string[];
  deadline?: string | null;
}

export interface PipOut {
  id: string;
  employee_id: string;
  employee_no: string;
  employee_name: string;
  period: string;
  goals: string[];
  deadline: string | null;
  status: PipStatusValue;
  conclusion: string | null;
  concluded_at: string | null;
  perf_result_id: string | null;
  linked_adjust_id: string | null;
  created_at: string;
}

export interface CoachingCreate {
  employee_id: string;
  content: string;
  happened_at: string;
  plan_id?: string | null;
}

export interface CoachingOut {
  id: string;
  employee_id: string;
  content: string;
  happened_at: string;
  plan_id: string | null;
  created_at: string;
}

export interface MyResultOut {
  plan_id: string;
  period: string;
  tool_type: ToolType;
  grade: Grade;
  score: number | null;
  coefficient: number;
  org_coefficient: number;
  evidence: string[];
  published_at: string;
}

export interface MyPerfOut {
  results: MyResultOut[];
  pips: PipOut[];
}

// ============ 常量 ============

export const DEFAULT_CONSTANTS = mockConstants;

export const perfApi = {
  getConstants(): Promise<PerfConstants> {
    if (USE_MOCK) return mockPerfApi.getConstants();
    return api.get<PerfConstants>('/perf/constants');
  },
  updateConstants(patch: ConstantsUpdate): Promise<PerfConstants> {
    if (USE_MOCK) return mockPerfApi.updateConstants(patch);
    return api.put<PerfConstants>('/perf/constants', patch);
  },

  // ---- 方案 ----
  listPlans(): Promise<PlanSummary[]> {
    if (USE_MOCK) return mockPerfApi.listPlans();
    return api.get<PlanSummary[]>('/perf/plans');
  },
  createPlan(body: PlanCreate): Promise<PlanOut> {
    if (USE_MOCK) return mockPerfApi.createPlan(body);
    return api.post<PlanOut>('/perf/plans', body);
  },
  getPlan(id: string): Promise<PlanOut> {
    if (USE_MOCK) return mockPerfApi.getPlan(id);
    return api.get<PlanOut>(`/perf/plans/${id}`);
  },
  updatePlan(id: string, body: PlanUpdate): Promise<PlanOut> {
    if (USE_MOCK) return mockPerfApi.updatePlan(id, body);
    return api.put<PlanOut>(`/perf/plans/${id}`, body);
  },
  replaceRoster(id: string, memberIds: string[]): Promise<PlanOut> {
    if (USE_MOCK) return mockPerfApi.replaceRoster(id, memberIds);
    return api.put<PlanOut>(`/perf/plans/${id}/roster`, { member_ids: memberIds });
  },
  transition(id: string, to: 'evaluating' | 'calibrating'): Promise<PlanOut> {
    if (USE_MOCK) return mockPerfApi.transition(id, { to });
    return api.post<PlanOut>(`/perf/plans/${id}/transition`, { to });
  },
  clone(id: string): Promise<PlanOut> {
    if (USE_MOCK) return mockPerfApi.clone(id);
    return api.post<PlanOut>(`/perf/plans/${id}/clone`, {});
  },

  // ---- 结果 ----
  listResults(planId: string): Promise<ResultOut[]> {
    if (USE_MOCK) return mockPerfApi.listResults(planId);
    return api.get<ResultOut[]>(`/perf/plans/${planId}/results`);
  },
  putResults(planId: string, items: ResultItemIn[]): Promise<ResultOut[]> {
    if (USE_MOCK) return mockPerfApi.putResults(planId, items);
    return api.put<ResultOut[]>(`/perf/plans/${planId}/results`, { items });
  },

  // ---- 校准/发布 ----
  distribution(planId: string): Promise<DistributionOut> {
    if (USE_MOCK) return mockPerfApi.distribution(planId);
    return api.get<DistributionOut>(`/perf/plans/${planId}/distribution`);
  },
  publish(
    planId: string,
    overrideReason: string | null,
  ): Promise<PlanOut> {
    if (USE_MOCK) {
      return mockPerfApi
        .publish(planId, overrideReason)
        .then((r) => r.plan);
    }
    return api.post<PlanOut>(`/perf/plans/${planId}/publish`, {
      override_reason: overrideReason,
    });
  },
  unpublish(planId: string): Promise<PlanOut> {
    if (USE_MOCK) return mockPerfApi.unpublish(planId);
    return api.post<PlanOut>(`/perf/plans/${planId}/unpublish`);
  },
  importResults(planId: string, body: PlanImportIn): Promise<PlanImportOut> {
    if (USE_MOCK) return mockPerfApi.importResults(planId, body);
    return api.post<PlanImportOut>(`/perf/plans/${planId}/import`, body);
  },

  // ---- PIP ----
  listPips(status?: PipStatusValue): Promise<PipOut[]> {
    if (USE_MOCK) return mockPerfApi.listPips(status);
    return api.get<PipOut[]>('/perf/pips', status ? { status } : undefined);
  },
  createPip(body: PipCreate): Promise<PipOut> {
    if (USE_MOCK) {
      return mockPerfApi.createPip({
        employee_id: body.employee_id,
        period: body.period,
        goals: body.goals ?? [],
        deadline: body.deadline ?? null,
        perf_result_id: body.perf_result_id ?? null,
      });
    }
    return api.post<PipOut>('/perf/pips', body);
  },
  updatePip(id: string, body: PipUpdate): Promise<PipOut> {
    if (USE_MOCK) return mockPerfApi.updatePip(id, body);
    return api.put<PipOut>(`/perf/pips/${id}`, body);
  },
  concludePip(
    id: string,
    result: 'passed' | 'failed',
    note: string | null,
  ): Promise<PipOut> {
    if (USE_MOCK) return mockPerfApi.concludePip(id, result, note);
    return api.post<PipOut>(`/perf/pips/${id}/conclusion`, {
      result,
      note,
    });
  },

  // ---- 辅导 ----
  listCoaching(employeeId: string): Promise<CoachingOut[]> {
    if (USE_MOCK) return mockPerfApi.listCoaching(employeeId);
    return api.get<CoachingOut[]>('/perf/coaching', { employee_id: employeeId });
  },
  createCoaching(body: CoachingCreate): Promise<CoachingOut> {
    if (USE_MOCK) {
      return mockPerfApi.createCoaching({
        employee_id: body.employee_id,
        content: body.content,
        happened_at: body.happened_at,
        plan_id: body.plan_id ?? null,
      });
    }
    return api.post<CoachingOut>('/perf/coaching', body);
  },

  // ---- 我的绩效 ----
  myPerf(selfEmployeeId: string): Promise<MyPerfOut> {
    if (USE_MOCK) return mockPerfApi.myPerf(selfEmployeeId);
    return api.get<MyPerfOut>('/perf/me');
  },
};

// 五档展示元数据
export const GRADE_COLOR: Record<Grade, string> = {
  S: '#7c3aed',
  A: '#1d4ed8',
  B: '#047857',
  C: '#b45309',
  D: '#b91c1c',
};

export const TOOL_LABEL: Record<ToolType, string> = {
  pbc: 'PBC',
  kpi: 'KPI',
  okr: 'OKR',
  '360': '360 评估',
};

/** 仅 PBC/KPI 发布回写档案等级并自动建 PIP */
export const WRITEBACK_TOOLS: ToolType[] = ['pbc', 'kpi'];

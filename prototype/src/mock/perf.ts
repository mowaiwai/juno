/**
 * 绩效内生 mock 数据集（P1）。
 * 模块内可变状态：页面在 mock 模式下可演示 建方案→录结果→校准→发布→PIP 全流程，
 * 刷新页面后回到初始数据。
 */
import type {
  CoachingOut,
  ConstantsUpdate,
  DistributionOut,
  Grade,
  MyPerfOut,
  PerfConstants,
  PipOut,
  PlanImportIn,
  PlanImportOut,
  PlanOut,
  PlanStatus,
  PlanSummary,
  PlanTransition,
  ResultItemIn,
  ResultOut,
  RosterMember,
  ToolType,
} from '@/api/perf';
import { employees } from './people';

const delay = async <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 120));

const byNo = new Map(employees.map((e) => [e.id, e]));

function member(no: string): RosterMember {
  const e = byNo.get(no)!;
  return {
    id: e.id,
    employee_no: e.id,
    name: e.name,
    dept_id: e.deptId,
    position: e.position,
    sequence: e.sequence,
  };
}

// ---------- 常量 ----------

export const mockConstants: PerfConstants = {
  score_cutoffs: { S: 95, A: 90, B: 80, C: 65, D: 0 },
  coefficients: { S: 1.5, A: 1.2, B: 1.0, D: 0.5 },
  c_divisor: 80,
  distribution: {
    S: [0, 0.05],
    A: [0, 0.15],
    B: [0.15, 0.8],
    CD: [0, 0.1],
  },
  small_roster_threshold: 10,
};

// ---------- 结果 ----------

interface MockResult {
  employeeId: string;
  grade: Grade;
  score: number | null;
  evidence: string[];
}

function coefficientOf(grade: Grade, score: number | null): number {
  if (grade === 'C') return Math.round(((score ?? 0) / mockConstants.c_divisor) * 100) / 100;
  const table = mockConstants.coefficients as Record<Grade, number | undefined>;
  return table[grade] ?? 1.0;
}

function resultOut(planId: string, r: MockResult): ResultOut {
  const e = byNo.get(r.employeeId)!;
  return {
    plan_id: planId,
    employee_id: r.employeeId,
    employee_no: r.employeeId,
    name: e.name,
    grade: r.grade,
    score: r.score,
    coefficient: coefficientOf(r.grade, r.score),
    org_coefficient: 1.0,
    evidence: r.evidence,
  };
}

// ---------- 方案 ----------

interface MockPlan {
  id: string;
  period: string;
  toolType: ToolType;
  status: PlanStatus;
  deptIds: string[];
  sequenceCodes: string[];
  roster: string[];
  results: MockResult[];
  overrideReason: string | null;
  publishedAt: string | null;
}

const ISO = '2026-01-15T09:00:00Z';

const TEAM_305 = [
  'E10020', 'E10087', 'E10088', 'E10086',
  'E10092', 'E10093', 'E10089', 'E10091', 'E10094',
];

const plans: MockPlan[] = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    period: '2025H2',
    toolType: 'kpi',
    status: 'published',
    deptIds: ['305'],
    sequenceCodes: [],
    roster: TEAM_305,
    overrideReason: '业务高速扩张期，校准会批准 S/A 上浮',
    publishedAt: ISO,
    results: [
      { employeeId: 'E10092', grade: 'S', score: 96, evidence: ['旗舰模块提前交付'] },
      { employeeId: 'E10087', grade: 'A', score: 92, evidence: ['核心架构改造'] },
      { employeeId: 'E10088', grade: 'A', score: 90, evidence: ['平台稳定性专项'] },
      { employeeId: 'E10094', grade: 'A', score: 91, evidence: ['新人带教突出'] },
      { employeeId: 'E10020', grade: 'B', score: 86, evidence: [] },
      { employeeId: 'E10086', grade: 'B', score: 84, evidence: [] },
      { employeeId: 'E10091', grade: 'B', score: 83, evidence: [] },
      { employeeId: 'E10089', grade: 'C', score: 75, evidence: [] },
      { employeeId: 'E10093', grade: 'D', score: 60, evidence: ['连续两个迭代延期'] },
    ],
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    period: '2026H1',
    toolType: 'kpi',
    status: 'calibrating',
    deptIds: ['305'],
    sequenceCodes: [],
    roster: ['E10020', 'E10087', 'E10086', 'E10092', 'E10093', 'E10091'],
    results: [
      { employeeId: 'E10092', grade: 'S', score: 97, evidence: ['行业级技术攻坚'] },
      { employeeId: 'E10087', grade: 'A', score: 92, evidence: ['核心链路重构'] },
      { employeeId: 'E10020', grade: 'B', score: 85, evidence: [] },
      { employeeId: 'E10086', grade: 'B', score: 84, evidence: [] },
      { employeeId: 'E10091', grade: 'B', score: 82, evidence: [] },
      // E10093 未评：演示缺结果拦截
    ],
    overrideReason: null,
    publishedAt: null,
  },
  {
    id: '11111111-0000-4000-8000-000000000003',
    period: '2026H2',
    toolType: 'okr',
    status: 'draft',
    deptIds: ['305'],
    sequenceCodes: [],
    roster: ['E10086', 'E10087', 'E10091', 'E10094'],
    results: [],
    overrideReason: null,
    publishedAt: null,
  },
];

function findPlan(id: string): MockPlan {
  const p = plans.find((x) => x.id === id);
  if (!p) throw Object.assign(new Error('plan_not_found'), {
    status: 404, code: 'plan_not_found', message: '考核方案不存在',
  });
  return p;
}

export function planOut(p: MockPlan): PlanOut {
  return {
    id: p.id,
    period: p.period,
    tool_type: p.toolType,
    status: p.status,
    scope_depts: p.deptIds,
    scope_sequences: p.sequenceCodes,
    roster_members: p.roster.map(member),
    excluded_members: [],
    distribution_override_reason: p.overrideReason,
    published_at: p.publishedAt,
    result_count: p.results.length,
  };
}

function planSummary(p: MockPlan): PlanSummary {
  return {
    id: p.id,
    period: p.period,
    tool_type: p.toolType,
    status: p.status,
    roster_size: p.roster.length,
    result_count: p.results.length,
    published_at: p.publishedAt,
  };
}

// ---------- 分布 ----------

function distributionOf(p: MockPlan): DistributionOut {
  const size = p.roster.length;
  const counts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const r of p.results) counts[r.grade] += 1;
  const graded = p.results.length;
  const ratio = (n: number) => (graded ? Math.round((n / graded) * 10000) / 10000 : 0);
  const ratios: Record<string, number> = {
    S: ratio(counts.S), A: ratio(counts.A), B: ratio(counts.B),
    C: ratio(counts.C), D: ratio(counts.D),
  };
  const cdRatio = ratio(counts.C + counts.D);
  const ungraded = p.roster
    .filter((no) => !p.results.some((r) => r.employeeId === no))
    .map((no) => {
      const e = byNo.get(no)!;
      return { employee_id: no, employee_no: no, name: e.name };
    });
  const bands: Record<string, [number, number]> = mockConstants.distribution;
  const violations: DistributionOut['violations'] = [];
  const bucketOf = (bucket: string, value: number) => {
    const [low, high] = bands[bucket];
    if (graded && (value < low || value > high)) {
      violations.push({ bucket, ratio: value, low, high });
    }
  };
  bucketOf('S', ratios.S);
  bucketOf('A', ratios.A);
  bucketOf('B', ratios.B);
  bucketOf('CD', cdRatio);
  return {
    roster_size: size,
    graded_count: graded,
    counts,
    ratios,
    cd_ratio: cdRatio,
    ungraded,
    violations,
    small_roster: size < mockConstants.small_roster_threshold,
  };
}

// ---------- PIP / 辅导 ----------

const pips: PipOut[] = [
  {
    id: '22222222-0000-4000-8000-000000000001',
    employee_id: 'E10093',
    employee_no: 'E10093',
    employee_name: '董斯年',
    period: '2025H2',
    goals: ['两个迭代内核心需求零延期', '补齐单测覆盖至 70%'],
    deadline: '2026-04-30',
    status: 'active',
    conclusion: null,
    concluded_at: null,
    perf_result_id: '33333333-0000-4000-8000-000000000001',
    linked_adjust_id: null,
    created_at: '2026-01-16T02:00:00Z',
  },
  {
    id: '22222222-0000-4000-8000-000000000002',
    employee_id: 'E10062',
    employee_no: 'E10062',
    employee_name: '范屿青',
    period: '2025H2',
    goals: ['流程合规零差错'],
    deadline: '2026-03-31',
    status: 'failed',
    conclusion: '改进期内再次出现错发料，进入人事流程',
    concluded_at: '2026-04-02T03:00:00Z',
    perf_result_id: null,
    linked_adjust_id: null,
    created_at: '2025-08-10T01:00:00Z',
  },
];

const coaching: CoachingOut[] = [
  {
    id: '44444444-0000-4000-8000-000000000001',
    employee_id: 'E10093',
    content: '一对一：拆解延期根因，约定每周五同步风险清单',
    happened_at: '2026-02-09',
    plan_id: '11111111-0000-4000-8000-000000000002',
    created_at: '2026-02-09T08:00:00Z',
  },
  {
    id: '44444444-0000-4000-8000-000000000002',
    employee_id: 'E10086',
    content: 'P4 认证准备沟通：建议主导一次跨组技术方案',
    happened_at: '2026-03-02',
    plan_id: null,
    created_at: '2026-03-02T08:00:00Z',
  },
];

// ---------- mock API 实现 ----------

let idSeq = 100;
const nextId = (prefix: string) =>
  `${prefix}0000-4000-8000-${String(++idSeq).padStart(12, '0')}`;

export const mockPerfApi = {
  // 常量
  getConstants: () => delay(mockConstants),
  updateConstants: (patch: ConstantsUpdate): Promise<PerfConstants> => {
    Object.assign(mockConstants, patch);
    return delay(mockConstants);
  },

  // 方案
  listPlans: (): Promise<PlanSummary[]> =>
    delay(plans.map(planSummary)),
  getPlan: (id: string): Promise<PlanOut> => delay(planOut(findPlan(id))),
  createPlan: (body: {
    period: string; tool_type: ToolType; dept_ids: string[];
    sequence_codes: string[]; exclude_ids?: string[];
  }): Promise<PlanOut> => {
    const candidates = employees.filter(
      (e) => body.dept_ids.includes(e.deptId)
        || body.sequence_codes.includes(e.sequence),
    );
    const excluded = new Set(body.exclude_ids ?? []);
    const plan: MockPlan = {
      id: crypto.randomUUID(),
      period: body.period,
      toolType: body.tool_type,
      status: 'draft',
      deptIds: body.dept_ids,
      sequenceCodes: body.sequence_codes,
      roster: candidates.map((e) => e.id).filter((id) => !excluded.has(id)),
      results: [],
      overrideReason: null,
      publishedAt: null,
    };
    plans.unshift(plan);
    return delay(planOut(plan));
  },
  updatePlan: (id: string, body: {
    period?: string; tool_type?: ToolType;
    dept_ids?: string[]; sequence_codes?: string[];
  }): Promise<PlanOut> => {
    const p = findPlan(id);
    if (p.status !== 'draft') throw planError(409, 'plan_not_draft', '仅草稿方案可修改');
    if (body.period) p.period = body.period;
    if (body.tool_type) p.toolType = body.tool_type;
    if (body.dept_ids) {
      p.deptIds = body.dept_ids;
      const candidates = new Set(
        employees.filter((e) => body.dept_ids!.includes(e.deptId)).map((e) => e.id),
      );
      p.roster = p.roster.filter((no) => candidates.has(no));
    }
    if (body.sequence_codes) p.sequenceCodes = body.sequence_codes;
    return delay(planOut(p));
  },
  replaceRoster: (id: string, memberIds: string[]): Promise<PlanOut> => {
    const p = findPlan(id);
    if (p.status !== 'draft') throw planError(409, 'plan_not_draft', '仅草稿方案可调整名册');
    p.roster = memberIds;
    return delay(planOut(p));
  },
  transition: (id: string, body: PlanTransition): Promise<PlanOut> => {
    const p = findPlan(id);
    p.status = body.to;
    return delay(planOut(p));
  },
  clone: (id: string): Promise<PlanOut> => {
    const src = findPlan(id);
    const plan: MockPlan = {
      ...src,
      id: crypto.randomUUID(),
      period: `${src.period}-副本`,
      status: 'draft',
      roster: [...src.roster],
      results: [],
      overrideReason: null,
      publishedAt: null,
    };
    plans.unshift(plan);
    return delay(planOut(plan));
  },

  // 结果
  listResults: (id: string): Promise<ResultOut[]> => {
    const p = findPlan(id);
    return delay(p.results.map((r) => resultOut(p.id, r)));
  },
  putResults: (id: string, items: ResultItemIn[]): Promise<ResultOut[]> => {
    const p = findPlan(id);
    if (p.status === 'draft') throw planError(409, 'plan_not_open', '方案尚未开放评定');
    if (p.status === 'published') throw planError(409, 'plan_published', '方案已发布');
    for (const item of items) upsertMockResult(p, item);
    return delay(p.results.map((r) => resultOut(p.id, r)));
  },

  // 分布/发布
  distribution: (id: string): Promise<DistributionOut> =>
    delay(distributionOf(findPlan(id))),
  publish: (
    id: string, reason: string | null,
  ): Promise<{ plan: PlanOut; distribution: DistributionOut }> => {
    const p = findPlan(id);
    const d = distributionOf(p);
    if (p.status !== 'calibrating') {
      throw planError(409, 'plan_not_calibrating', '仅校准中方案可发布');
    }
    if (d.ungraded.length) {
      throw planError(422, 'results_incomplete', '存在未评定成员', {
        ungraded_ids: d.ungraded.map((u) => u.employee_id),
      });
    }
    if (!d.small_roster && d.violations.length && !reason) {
      throw planError(422, 'distribution_override_required', '分布越界需填写理由', {
        violations: d.violations,
      });
    }
    p.status = 'published';
    p.publishedAt = new Date().toISOString();
    p.overrideReason = reason;
    // D 自动建 PIP（PBC/KPI 才回写、建 PIP）
    if (p.toolType === 'pbc' || p.toolType === 'kpi') {
      for (const r of p.results.filter((x) => x.grade === 'D')) {
        if (!pips.some((x) => x.employee_id === r.employeeId && x.period === p.period)) {
          pips.unshift({
            id: crypto.randomUUID(),
            employee_id: r.employeeId,
            employee_no: r.employeeId,
            employee_name: byNo.get(r.employeeId)!.name,
            period: p.period,
            goals: [],
            deadline: null,
            status: 'active',
            conclusion: null,
            concluded_at: null,
            perf_result_id: null,
            linked_adjust_id: null,
            created_at: new Date().toISOString(),
          });
        }
      }
    }
    return delay({ plan: planOut(p), distribution: d });
  },
  unpublish: (id: string): Promise<PlanOut> => {
    const p = findPlan(id);
    p.status = 'calibrating';
    p.publishedAt = null;
    return delay(planOut(p));
  },
  importResults: (id: string, body: PlanImportIn): Promise<PlanImportOut> => {
    const p = findPlan(id);
    if (p.status !== 'draft') throw planError(409, 'plan_not_draft', '仅草稿方案可导入');
    const roster = new Set(p.roster);
    const seen = new Set<string>();
    const errors: PlanImportOut['errors'] = [];
    let imported = 0;
    for (const item of body.items) {
      const no = item.employee_no.trim();
      if (!no) { errors.push({ employee_no: no, reason: '工号为空' }); continue; }
      if (seen.has(no)) { errors.push({ employee_no: no, reason: '工号重复' }); continue; }
      seen.add(no);
      if (!roster.has(no)) {
        errors.push({ employee_no: no, reason: '工号不存在或不在方案名册内' });
        continue;
      }
      upsertMockResult(p, {
        employee_id: no, grade: item.grade, score: item.score ?? null, evidence: [],
      });
      imported += 1;
    }
    return delay({ imported, errors });
  },

  // PIP
  listPips: (status?: string): Promise<PipOut[]> =>
    delay(status ? pips.filter((p) => p.status === status) : [...pips]),
  createPip: (body: {
    employee_id: string; period: string; goals: string[];
    deadline: string | null; perf_result_id: string | null;
  }): Promise<PipOut> => {
    const e = byNo.get(body.employee_id);
    if (!e) throw planError(404, 'employee_not_found', '员工不存在');
    const pip: PipOut = {
      id: crypto.randomUUID(),
      employee_id: e.id,
      employee_no: e.id,
      employee_name: e.name,
      period: body.period,
      goals: body.goals,
      deadline: body.deadline,
      status: 'active',
      conclusion: null,
      concluded_at: null,
      perf_result_id: body.perf_result_id,
      linked_adjust_id: null,
      created_at: new Date().toISOString(),
    };
    pips.unshift(pip);
    return delay(pip);
  },
  updatePip: (id: string, body: { goals?: string[]; deadline?: string | null })
    : Promise<PipOut> => {
    const pip = pips.find((x) => x.id === id);
    if (!pip) throw planError(404, 'pip_not_found', '改进计划不存在');
    if (pip.status !== 'active') throw planError(409, 'pip_closed', '已终结的改进计划不可修改');
    if (body.goals !== undefined) pip.goals = body.goals;
    if (body.deadline !== undefined) pip.deadline = body.deadline;
    return delay(pip);
  },
  concludePip: (id: string, result: 'passed' | 'failed', note: string | null)
    : Promise<PipOut> => {
    const pip = pips.find((x) => x.id === id);
    if (!pip) throw planError(404, 'pip_not_found', '改进计划不存在');
    if (pip.status !== 'active') throw planError(409, 'pip_closed', '改进计划已终结');
    pip.status = result;
    pip.conclusion = note;
    pip.concluded_at = new Date().toISOString();
    return delay(pip);
  },

  // 辅导
  listCoaching: (employeeId: string): Promise<CoachingOut[]> =>
    delay(coaching.filter((c) => c.employee_id === employeeId)),
  createCoaching: (body: {
    employee_id: string; content: string; happened_at: string;
    plan_id: string | null;
  }): Promise<CoachingOut> => {
    if (!byNo.has(body.employee_id)) {
      throw planError(404, 'employee_not_found', '员工不存在');
    }
    const rec: CoachingOut = {
      id: crypto.randomUUID(),
      employee_id: body.employee_id,
      content: body.content,
      happened_at: body.happened_at,
      plan_id: body.plan_id,
      created_at: new Date().toISOString(),
    };
    coaching.unshift(rec);
    return delay(rec);
  },

  // 我的绩效（mock 以 E10086 为员工视角）
  myPerf: (selfEmployeeId: string): Promise<MyPerfOut> => {
    const results = plans
      .filter((p) => p.status === 'published')
      .flatMap((p) => p.results
        .filter((r) => r.employeeId === selfEmployeeId)
        .map((r) => ({
          plan_id: p.id,
          period: p.period,
          tool_type: p.toolType,
          grade: r.grade,
          score: r.score,
          coefficient: coefficientOf(r.grade, r.score),
          org_coefficient: 1.0,
          evidence: r.evidence,
          published_at: p.publishedAt ?? new Date().toISOString(),
        })));
    return delay({
      results,
      pips: pips.filter((p) => p.employee_id === selfEmployeeId),
    });
  },
};

function upsertMockResult(p: MockPlan, item: ResultItemIn) {
  const existing = p.results.find((r) => r.employeeId === item.employee_id);
  const row = {
    employeeId: item.employee_id,
    grade: item.grade,
    score: item.score ?? null,
    evidence: item.evidence ?? [],
  };
  if (existing) Object.assign(existing, row);
  else p.results.push(row);
}

function planError(
  status: number, code: string, message: string, details?: unknown,
): Error & { status: number; code: string; details?: unknown } {
  return Object.assign(new Error(message), { status, code, details });
}

// 供页面引用的常量导出
export { nextId };

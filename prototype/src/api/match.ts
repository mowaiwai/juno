/** 统一人岗匹配度引擎接口（PRD 模块四 P3，后端 /match/*）。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { employees as mockEmployees } from '@/mock/people';

// ============ 五维常量（与后端 services/match.py 对齐） ============

export const MATCH_DIMS = ['perf', 'duty', 'ability', 'contribution', 'knowledge'] as const;
export type MatchDim = (typeof MATCH_DIMS)[number];

export const DIM_LABEL: Record<MatchDim, string> = {
  perf: '绩效',
  duty: '职责履行',
  ability: '能力素质',
  contribution: '团队贡献',
  knowledge: '知识技能',
};

/** 匹配等级 → 展示 */
export const LEVEL_LABEL: Record<string, string> = {
  good: '匹配良好',
  watch: '观察/可培养',
  mismatch: '错位预警',
  insufficient_data: '数据不足',
};
export const LEVEL_COLOR: Record<string, string> = {
  good: 'var(--sage)',
  watch: 'var(--ochre)',
  mismatch: 'var(--danger)',
  insufficient_data: 'var(--ink-4)',
};

// ============ 类型定义 ============

export interface MatchConfigOut {
  weights: Record<string, number>;
  required: Record<string, number>;
  good_threshold: number;
  warn_threshold: number;
  is_default: boolean;
}

export interface MatchConfigIn {
  weights: Record<string, number>;
  required: Record<string, number>;
  good_threshold: number;
  warn_threshold: number;
}

export interface HeatmapIn {
  dept_id?: string;
  batch_id?: string;
}

export interface HeatmapDimOut {
  key: string;
  actual: number | null;
  required: number | null;
  ratio: number | null;
  is_gap: boolean;
}

export interface HeatmapRowOut {
  employee_id: string;
  name: string;
  position: string | null;
  score: number | null;
  level: string;
  reason: string;
  missing_dims: string[];
  dims: HeatmapDimOut[];
}

export interface RecommendIn {
  employee_id?: string;
  standard_set_id?: string;
  sequence?: string;
  target_grade?: string;
  limit?: number;
}

export interface RecommendItemOut {
  set_id?: string | null;
  sequence?: string | null;
  target_grade?: string | null;
  employee_id?: string | null;
  name?: string | null;
  position?: string | null;
  score: number | null;
  level: string;
  missing_dims: string[];
}

export interface RecommendOut {
  direction: 'positions' | 'employees';
  items: RecommendItemOut[];
}

// ============ Mock 数据 ============

/** 平台默认配置（与后端 match_config 默认值一致），PUT 后会话内生效 */
let _mockConfig: MatchConfigOut = {
  weights: { perf: 0.3, duty: 0.2, ability: 0.2, contribution: 0.15, knowledge: 0.15 },
  required: { perf: 75, duty: 75, ability: 75, contribution: 75, knowledge: 75 },
  good_threshold: 80,
  warn_threshold: 60,
  is_default: true,
};

/** 由 mock 员工档案推导五维实际分（确定性，保证演示稳定） */
function mockActuals(e: (typeof mockEmployees)[number]): Record<MatchDim, number> {
  const seed = Number(e.id.slice(1)) % 7;
  const potScore = e.potential === 'HIGH' ? 88 : e.potential === 'MID' ? 76 : 62;
  return {
    perf: e.perfScore,
    duty: Math.min(100, e.perfScore - 3 + seed),
    ability: Math.min(100, potScore + seed - 2),
    contribution: Math.min(100, 58 + e.years * 3 + seed),
    knowledge: Math.min(100, e.perfScore - 8 + seed * 2),
  };
}

function mockScore(
  actual: Record<MatchDim, number>,
  required: Record<string, number>,
  weights: Record<string, number>,
  good: number,
  warn: number,
): { score: number; level: string; dims: HeatmapDimOut[]; missing: string[]; reason: string } {
  let sum = 0;
  let wsum = 0;
  const dims: HeatmapDimOut[] = [];
  const gaps: string[] = [];
  for (const key of MATCH_DIMS) {
    const a = actual[key];
    const r = required[key] ?? 0;
    const ratio = r > 0 ? Math.min(a / r, 1) : 1;
    const isGap = ratio < 1;
    if (isGap) gaps.push(`${DIM_LABEL[key]} ${a}/${r}`);
    const w = weights[key] ?? 0;
    sum += w * ratio;
    wsum += w;
    dims.push({ key, actual: a, required: r, ratio, is_gap: isGap });
  }
  const score = wsum > 0 ? Math.round((sum / wsum) * 1000) / 10 : 0;
  const level = score >= good ? 'good' : score >= warn ? 'watch' : 'mismatch';
  const reason = gaps.length ? `差距：${gaps.join('；')}` : '五维全部达标';
  return { score, level, dims, missing: [], reason };
}

/** mock 岗位方向选项（一人多岗推荐用） */
const MOCK_POSITION_OPTIONS = [
  { sequence: 'SW', target_grade: 'P4', label: '软件序列 · P4 高级软件工程师' },
  { sequence: 'SW', target_grade: 'P5', label: '软件序列 · P5 资深软件工程师' },
  { sequence: 'ENG', target_grade: 'P4', label: '机械序列 · P4 高级机械工程师' },
  { sequence: 'OP', target_grade: 'T4', label: '工艺序列 · T4 高级技师' },
  { sequence: 'MGT', target_grade: 'M2', label: '管理序列 · M2 部门经理' },
  { sequence: 'SAL', target_grade: 'O3', label: '营销序列 · O3 市场经理' },
];

// ============ API ============

export const matchApi = {
  getConfig: (): Promise<MatchConfigOut> => {
    if (USE_MOCK) return Promise.resolve({ ..._mockConfig });
    return api.get<MatchConfigOut>('/match/config');
  },

  updateConfig: (body: MatchConfigIn): Promise<MatchConfigOut> => {
    if (USE_MOCK) {
      _mockConfig = { ...body, is_default: false };
      return Promise.resolve({ ..._mockConfig });
    }
    return api.put<MatchConfigOut>('/match/config', body);
  },

  heatmap: (body: HeatmapIn): Promise<HeatmapRowOut[]> => {
    if (USE_MOCK) {
      const cfg = _mockConfig;
      const list = body.dept_id
        ? mockEmployees.filter((e) => e.deptId === body.dept_id)
        : mockEmployees;
      return Promise.resolve(
        list.map((e) => {
          const r = mockScore(mockActuals(e), cfg.required, cfg.weights, cfg.good_threshold, cfg.warn_threshold);
          return {
            employee_id: e.id,
            name: e.name,
            position: e.position,
            score: r.score,
            level: r.level,
            reason: r.reason,
            missing_dims: r.missing,
            dims: r.dims,
          };
        }),
      );
    }
    return api.post<HeatmapRowOut[]>('/match/heatmap', body);
  },

  recommend: (body: RecommendIn): Promise<RecommendOut> => {
    if (USE_MOCK) {
      const cfg = _mockConfig;
      const limit = body.limit ?? 5;
      if (body.employee_id) {
        const emp = mockEmployees.find((e) => e.id === body.employee_id) ?? mockEmployees[0];
        const actual = mockActuals(emp);
        const items = MOCK_POSITION_OPTIONS.map((p, i) => {
          const required = Object.fromEntries(
            MATCH_DIMS.map((d) => [d, Math.min(100, (cfg.required[d] ?? 75) + i * 4)]),
          );
          const r = mockScore(actual, required, cfg.weights, cfg.good_threshold, cfg.warn_threshold);
          return {
            set_id: null,
            sequence: p.sequence,
            target_grade: p.target_grade,
            score: r.score,
            level: r.level,
            missing_dims: [],
          } as RecommendItemOut;
        }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit);
        return Promise.resolve({ direction: 'positions', items });
      }
      const items = mockEmployees
        .map((e) => {
          const r = mockScore(mockActuals(e), cfg.required, cfg.weights, cfg.good_threshold, cfg.warn_threshold);
          return {
            employee_id: e.id,
            name: e.name,
            position: e.position,
            score: r.score,
            level: r.level,
            missing_dims: [],
          } as RecommendItemOut;
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit);
      return Promise.resolve({ direction: 'employees', items });
    }
    return api.post<RecommendOut>('/match/recommend', body);
  },
};

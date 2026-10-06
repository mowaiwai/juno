/** 组织诊断接口。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { employees as mockEmployees } from '@/mock/people';
import {
  deptStructures as mockDeptStructures,
  gapWarnings as mockGapWarnings,
  threeCharts as mockThreeCharts,
  liquidProjects as mockLiquidProjects,
  matchCandidates as mockMatchCandidates,
  type LiquidProject,
  type GapWarning,
  type TeamCandidate,
} from '@/mock/inventory';

// ============ 类型定义 ============

export interface DeptStructureOut {
  dept_id: string;
  dept_name: string;
  headcount: number;
  grade_count: Record<string, number>;
  shape: string;
  shape_label: string;
  mid_ratio: number;
}

export interface GapWarningOut {
  position_id: string;
  position_name: string;
  dept_name: string;
  incumbent_id: string | null;
  incumbent_name: string | null;
  level: string;
  reason: string;
  suggestion: string;
}

export interface ThreeChartsOut {
  year: number;
  strategy: { initiative: string; talent_support: number | string; owner: string; note: string }[];
  org: {
    departments: number;
    key_positions: number;
    succession_coverage: number;
    org_changes: number;
  };
  talent: {
    p4_plus_ratio: number;
    high_potential_count: number;
    risk_count: number;
    scatter: { emp_id: string; x: number; y: number; size: number }[];
    willingness_anomaly: string[];
  };
}

export interface TalentMapOut {
  dept_id: string;
  scatter: { emp_id: string; x: number; y: number; size: number }[];
  quadrants: Record<string, number>;
  willingness_anomaly: string[];
}

export interface LiquidProjectOut {
  id: string;
  tenant_id: string;
  name: string;
  dept_name: string;
  needs: { ability: string; level: number }[];
  deadline: string;
  status: string;
}

export interface ProjectTeamIn {
  project_id: string;
}

export interface TeamCandidateOut {
  employee_id: string;
  name: string;
  position: string;
  /** 匹配引擎分（0-100，一位小数） */
  match_score: number;
  /** willing / unwilling / unconfirmed（mock 旧数据可能为 high/mid/low） */
  willingness: string;
  /** ready / developing / gap（mock 旧数据可能为 6m/1y） */
  readiness: string;
  reason: string;
  missing_dims: string[];
}

// ============ Mock 转换 ============

const mockStructToOut = (m: ReturnType<typeof mockDeptStructures>[0]): DeptStructureOut => ({
  dept_id: m.deptId,
  dept_name: m.deptName,
  headcount: m.headcount,
  grade_count: m.gradeCount,
  shape: m.shape,
  shape_label: m.shapeLabel,
  mid_ratio: m.midRatio,
});

const mockWarnToOut = (m: GapWarning): GapWarningOut => ({
  position_id: m.positionId,
  position_name: m.positionName,
  dept_name: m.deptName,
  incumbent_id: m.incumbentId,
  incumbent_name: m.incumbentName,
  level: m.level,
  reason: m.reason,
  suggestion: m.suggestion,
});

const mockChartToOut = (m: typeof mockThreeCharts): ThreeChartsOut => ({
  year: m.year,
  strategy: m.strategy.map((s) => ({
    initiative: s.initiative,
    talent_support: s.talentSupport,
    owner: s.owner,
    note: s.note,
  })),
  org: {
    departments: m.org.departments,
    key_positions: m.org.keyPositions,
    succession_coverage: m.org.successionCoverage,
    org_changes: m.org.orgChanges,
  },
  talent: {
    p4_plus_ratio: m.talent.p4PlusRatio,
    high_potential_count: m.talent.highPotentialCount,
    risk_count: m.talent.riskCount,
    scatter: m.talent.scatter.map((p) => ({
      emp_id: p.empId,
      x: p.x,
      y: p.y,
      size: p.size,
    })),
    willingness_anomaly: m.talent.willingnessAnomaly,
  },
});

const mockProjToOut = (m: LiquidProject): LiquidProjectOut => ({
  id: m.id,
  tenant_id: 'mock',
  name: m.name,
  dept_name: m.deptName,
  needs: m.needs,
  deadline: m.deadline,
  status: m.status,
});

const mockCandToOut = (m: TeamCandidate): TeamCandidateOut => ({
  employee_id: m.employeeId,
  name: m.name,
  position: m.position,
  match_score: m.matchScore,
  willingness: m.willingness,
  readiness: m.readiness,
  reason: m.reason,
  missing_dims: [],
});

// ============ 模块五 P3：结构优化类型 ============

export interface ClassificationOut {
  employee_id: string;
  name: string;
  dept_name: string;
  position: string;
  sequence: string;
  grade: string;
  category: string;
  category_label: string;
  perf_score: number | null;
  ability_score: number | null;
  willingness: string;
  reason: string;
}

export interface ClassificationSummary {
  core: number;
  competent: number;
  transformable: number;
  optimize: number;
  unclassified: number;
  total: number;
}

export interface DensityOut {
  total: number;
  core_count: number;
  core_ratio: number;
  sequence_dist: Record<string, number>;
  level_dist: Record<string, number>;
  shape: string;
  shape_label: string;
  mid_ratio: number;
  high_potential: number;
  risk_count: number;
}

export interface ImbalanceItem {
  sequence: string;
  level_order: number;
  level_name: string;
  type: string;
  type_label: string;
  detail: string;
}

export interface OptimizeAdviceIn {
  focus?: string;
}

export interface OptimizeAdviceOut {
  advice: string;
  source: string;
  generated_at: string;
}

// ============ Mock 数据 ============

const _PERF_MAP: Record<string, number> = { S: 95, A: 90, B: 80, C: 70, D: 60 };

function _mockClassify(perf: number | null, ability: number | null): { category: string; category_label: string; reason: string } {
  if (perf === null && ability === null) return { category: 'unclassified', category_label: '未分类', reason: '数据缺失' };
  const p = perf ?? 0;
  const a = ability ?? 0;
  if (p >= 85 && a >= 80) return { category: 'core', category_label: '核心', reason: `绩效 ${p} ≥ 85 且能力 ${a} ≥ 80` };
  if (p >= 75 && a >= 70) return { category: 'competent', category_label: '胜任', reason: `绩效 ${p} ≥ 75 且能力 ${a} ≥ 70` };
  if (p >= 70 && a >= 60) return { category: 'transformable', category_label: '可转型', reason: `绩效 ${p} ≥ 70 且能力 ${a} ≥ 60` };
  return { category: 'optimize', category_label: '待优化', reason: `绩效 ${p} < 70 或能力 ${a} < 60` };
}

function _mockClassification(): ClassificationOut[] {
  return mockEmployees.map((e) => {
    const perf = _PERF_MAP[e.perf] ?? null;
    const ability = e.potential === 'HIGH' ? 88 : e.potential === 'MID' ? 76 : 62;
    const { category, category_label, reason } = _mockClassify(perf, ability);
    return {
      employee_id: e.id,
      name: e.name,
      dept_name: e.deptId,
      position: e.position,
      sequence: e.sequence,
      grade: e.grade,
      category,
      category_label,
      perf_score: perf,
      ability_score: ability,
      willingness: 'none',
      reason,
    };
  });
}

function _mockDensity(): DensityOut {
  const total = mockEmployees.length;
  const coreCount = _mockClassification().filter((c) => c.category === 'core').length;
  const seqDist: Record<string, number> = {};
  const levelDist: Record<string, number> = {};
  for (const e of mockEmployees) {
    seqDist[e.sequence] = (seqDist[e.sequence] || 0) + 1;
    const num = parseInt(e.grade.slice(1), 10);
    if (!Number.isNaN(num)) {
      const lvl = e.sequence === 'MGT' ? (num <= 2 ? 3 : num === 3 ? 4 : num === 4 ? 5 : 6) : num;
      levelDist[String(lvl)] = (levelDist[String(lvl)] || 0) + 1;
    }
  }
  const midCount = mockEmployees.filter((e) => {
    const num = parseInt(e.grade.slice(1), 10);
    return num >= 3 && num <= 5;
  }).length;
  return {
    total,
    core_count: coreCount,
    core_ratio: total ? Math.round((coreCount / total) * 100) / 100 : 0,
    sequence_dist: seqDist,
    level_dist: levelDist,
    shape: midCount / total < 0.3 ? 'dumbbell' : midCount / total > 0.5 ? 'diamond' : 'pyramid',
    shape_label: midCount / total < 0.3 ? '哑铃型' : midCount / total > 0.5 ? '钻石型' : '金字塔型',
    mid_ratio: total ? Math.round((midCount / total) * 100) / 100 : 0,
    high_potential: mockEmployees.filter((e) => e.potential === 'HIGH').length,
    risk_count: mockEmployees.filter((e) => e.perf === 'D').length,
  };
}

function _mockImbalance(): ImbalanceItem[] {
  const items: ImbalanceItem[] = [];
  const density = _mockDensity();
  const standards: Record<string, number> = { SW: 11, ENG: 8, OP: 15, MGT: 15, SAL: 7, PUR: 5, HR: 3, OPS: 3 };
  for (const [seq, demand] of Object.entries(standards)) {
    const supply = density.sequence_dist[seq] || 0;
    const gap = supply - demand;
    if (gap < -0.5) {
      items.push({ sequence: seq, level_order: 0, level_name: '', type: 'shortage', type_label: '缺口', detail: `${seq} 序列：需求 ${demand}，在岗 ${supply}，缺 ${Math.abs(gap)} 人` });
    } else if (gap > 0.5) {
      items.push({ sequence: seq, level_order: 0, level_name: '', type: 'surplus', type_label: '冗余', detail: `${seq} 序列：需求 ${demand}，在岗 ${supply}，余 ${gap} 人` });
    }
  }
  return items;
}

// ============ API ============

export const orgApi = {
  structure: (): Promise<DeptStructureOut[]> => {
    if (USE_MOCK) return Promise.resolve(mockDeptStructures().map(mockStructToOut));
    return api.get<DeptStructureOut[]>('/org/structure');
  },

  gapWarnings: (): Promise<GapWarningOut[]> => {
    if (USE_MOCK) return Promise.resolve(mockGapWarnings.map(mockWarnToOut));
    return api.get<GapWarningOut[]>('/org/gap-warnings');
  },

  threeCharts: (): Promise<ThreeChartsOut> => {
    if (USE_MOCK) return Promise.resolve(mockChartToOut(mockThreeCharts));
    return api.get<ThreeChartsOut>('/org/three-charts');
  },

  talentMap: (deptId?: string): Promise<TalentMapOut> => {
    if (USE_MOCK) return Promise.resolve(mockChartToOut(mockThreeCharts) as unknown as TalentMapOut);
    return api.get<TalentMapOut>('/org/talent-map', { dept_id: deptId });
  },

  liquidProjects: (): Promise<LiquidProjectOut[]> => {
    if (USE_MOCK) return Promise.resolve(mockLiquidProjects.map(mockProjToOut));
    return api.get<LiquidProjectOut[]>('/org/liquid-projects');
  },

  /** 项目组队：走统一匹配引擎端点（旧 /org/project-team 后端保留兼容） */
  projectTeam: (body: ProjectTeamIn): Promise<TeamCandidateOut[]> => {
    if (USE_MOCK) {
      const proj = mockLiquidProjects[0];
      return Promise.resolve(mockMatchCandidates(proj).map(mockCandToOut));
    }
    return api.post<TeamCandidateOut[]>('/match/project-team', body);
  },

  // ============ 模块五 P3：结构优化 ============

  classification: (): Promise<ClassificationOut[]> => {
    if (USE_MOCK) return Promise.resolve(_mockClassification());
    return api.get<ClassificationOut[]>('/org/classification');
  },

  classificationSummary: (): Promise<ClassificationSummary> => {
    if (USE_MOCK) {
      const items = _mockClassification();
      const summary: ClassificationSummary = { core: 0, competent: 0, transformable: 0, optimize: 0, unclassified: 0, total: items.length };
      for (const it of items) {
        if (it.category === 'core') summary.core++;
        else if (it.category === 'competent') summary.competent++;
        else if (it.category === 'transformable') summary.transformable++;
        else if (it.category === 'optimize') summary.optimize++;
        else summary.unclassified++;
      }
      return Promise.resolve(summary);
    }
    return api.get<ClassificationSummary>('/org/classification/summary');
  },

  density: (): Promise<DensityOut> => {
    if (USE_MOCK) return Promise.resolve(_mockDensity());
    return api.get<DensityOut>('/org/density');
  },

  imbalance: (): Promise<ImbalanceItem[]> => {
    if (USE_MOCK) return Promise.resolve(_mockImbalance());
    return api.get<ImbalanceItem[]>('/org/imbalance');
  },

  optimizeAdvice: (body: OptimizeAdviceIn): Promise<OptimizeAdviceOut> => {
    if (USE_MOCK) {
      return Promise.resolve({
        advice: '基于当前数据：1）保留激励核心人才，防止流失；2）对可转型员工制定 6 个月培养计划；3）待优化员工启动 PIP 或调岗评估；4）针对缺口层级优先招聘，同时内部选拔培养。',
        source: 'rule_based',
        generated_at: new Date().toISOString(),
      });
    }
    return api.post<OptimizeAdviceOut>('/org/optimize-advice', body);
  },
};

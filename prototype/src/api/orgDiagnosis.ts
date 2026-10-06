/** 组织诊断接口。 */
import { api } from './client';
import { USE_MOCK } from './config';
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
};

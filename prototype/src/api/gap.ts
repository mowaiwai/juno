/** 人岗匹配 / 差距分析接口。 */
import { api } from './client';
import { USE_MOCK } from './config';
import {
  ACTION_LABEL as MOCK_ACTION_LABEL,
  ACTION_COLOR as MOCK_ACTION_COLOR,
  GAP_DIM_LABEL as MOCK_DIM_LABEL,
  DIM_TO_ACTION as MOCK_DIM_ACTION,
  gapsOf as mockGapsOf,
  teamGapBoard as mockTeamGapBoard,
} from '@/mock/gap';

// ============ 标签/颜色（直接复用 mock 常量，保持 UI 一致） ============

export const GAP_DIM_LABEL = MOCK_DIM_LABEL;
export const ACTION_LABEL = MOCK_ACTION_LABEL;
export const ACTION_COLOR = MOCK_ACTION_COLOR;
export const DIM_TO_ACTION = MOCK_DIM_ACTION;

// ============ 类型定义 ============

export interface GapOut {
  id: string;
  tenant_id: string;
  employee_id: string;
  dimension: string;
  detail: string;
  standard: string;
  current: string;
  severity: string;
  action: string;
  priority: number;
  batch_id: string | null;
}

export interface GapAnalyzeIn {
  dept_id?: string;
  batch_id?: string;
}

export interface GapActionIn {
  gap_ids: string[];
}

export interface GapActionOut {
  gap_id: string;
  employee_id: string;
  action: string;
  priority: number;
  suggestion: string;
}

export interface TeamGapOut {
  employee_id: string;
  name: string;
  position: string;
  dept_name: string;
  gap_count: number;
  high_count: number;
  actions: string[];
  gaps: GapOut[];
}

// ============ Mock 转换 ============

const mockGapToOut = (m: ReturnType<typeof mockGapsOf>[0]): GapOut => ({
  id: m.id,
  tenant_id: 'mock',
  employee_id: m.employeeId,
  dimension: m.dimension,
  detail: m.detail,
  standard: m.standard,
  current: m.current,
  severity: m.severity,
  action: m.action,
  priority: m.priority,
  batch_id: null,
});

const mockTeamToOut = (m: ReturnType<typeof mockTeamGapBoard>[0]): TeamGapOut => ({
  employee_id: m.employeeId,
  name: m.name,
  position: m.position,
  dept_name: m.deptName,
  gap_count: m.gapCount,
  high_count: m.highCount,
  actions: m.actions,
  gaps: m.gaps.map(mockGapToOut),
});

// ============ API ============

export const gapApi = {
  analyze: (body: GapAnalyzeIn): Promise<GapOut[]> => {
    if (USE_MOCK) {
      return Promise.resolve(mockGapsOf('E10086').map(mockGapToOut));
    }
    return api.post<GapOut[]>('/gaps/analyze', body);
  },

  list: (deptId?: string, dimension?: string): Promise<GapOut[]> => {
    if (USE_MOCK) {
      let list = mockGapsOf('E10086');
      if (dimension) list = list.filter((g) => g.dimension === dimension);
      return Promise.resolve(list.map(mockGapToOut));
    }
    const query: Record<string, string | undefined> = {};
    if (deptId) query.dept_id = deptId;
    if (dimension) query.dimension = dimension;
    return api.get<GapOut[]>('/gaps', query);
  },

  mine: (): Promise<GapOut[]> => {
    if (USE_MOCK) {
      return Promise.resolve(mockGapsOf('E10086').map(mockGapToOut));
    }
    return api.get<GapOut[]>('/gaps/mine');
  },

  team: (deptId?: string): Promise<TeamGapOut[]> => {
    if (USE_MOCK) {
      return Promise.resolve(mockTeamGapBoard(deptId).map(mockTeamToOut));
    }
    const query: Record<string, string | undefined> = {};
    if (deptId) query.dept_id = deptId;
    return api.get<TeamGapOut[]>('/gaps/team', query);
  },

  action: (body: GapActionIn): Promise<GapActionOut[]> => {
    if (USE_MOCK) {
      return Promise.resolve([]);
    }
    return api.post<GapActionOut[]>('/gaps/action', body);
  },
};

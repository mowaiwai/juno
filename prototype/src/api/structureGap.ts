/** 人才缺口预测接口（后端 /structure/*）。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { employees as mockEmployees } from '@/mock/people';

// ============ 类型定义（与 backend/app/schemas/structure_gap.py 对齐） ============

export interface GapConfigOut {
  factor_l1: number;
  factor_l2: number;
  factor_l3: number;
  is_default: boolean;
}

export interface GapConfigIn {
  factor_l1: number;
  factor_l2: number;
  factor_l3: number;
}

export interface HeadcountRow {
  sequence: string;
  level_order: number;
  headcount: number;
}

export interface HeadcountStandardsIn {
  rows: HeadcountRow[];
}

export interface HeadcountRowOut extends HeadcountRow {}

export interface GapCellOut {
  sequence: string;
  level_order: number;
  level_name: string | null;
  demand: number;
  supply_active: number;
  supply_pool: number;
  supply_total: number;
  gap: number;
  severity: string;
}

export interface UnmappedOut {
  count: number;
  grades: string[];
}

export interface GapSummaryOut {
  total_demand: number;
  total_supply: number;
  total_gap: number;
  shortage_cells: number;
  surplus_cells: number;
}

export interface GapForecastOut {
  cells: GapCellOut[];
  unmapped: UnmappedOut;
  config: GapConfigOut;
  summary: GapSummaryOut;
}

// ============ 常量 ============

const LEVEL_NAMES = ['基础层', '经验层', '骨干层', '精英层', '事业单位经营层', '集团经营层'];

/** grade → level_order（与后端口径一致） */
function gradeToLevel(grade: string, sequence: string): number | null {
  const num = parseInt(grade.slice(1), 10);
  if (Number.isNaN(num)) return null;
  if (sequence === 'MGT') {
    if (grade === 'M1' || grade === 'M2') return 3;
    if (grade === 'M3') return 4;
    if (grade === 'M4') return 5;
    if (grade === 'M5') return 6;
    return null;
  }
  return num;
}

// ============ Mock 数据 ============

let _mockConfig: GapConfigOut = {
  factor_l1: 1.0,
  factor_l2: 0.5,
  factor_l3: 0.2,
  is_default: true,
};

let _mockStandards: HeadcountRow[] = [
  // 软件序列
  { sequence: 'SW', level_order: 1, headcount: 2 },
  { sequence: 'SW', level_order: 2, headcount: 5 },
  { sequence: 'SW', level_order: 3, headcount: 2 },
  { sequence: 'SW', level_order: 4, headcount: 2 },
  { sequence: 'SW', level_order: 5, headcount: 0 },
  { sequence: 'SW', level_order: 6, headcount: 0 },
  // 机械序列
  { sequence: 'ENG', level_order: 1, headcount: 1 },
  { sequence: 'ENG', level_order: 2, headcount: 2 },
  { sequence: 'ENG', level_order: 3, headcount: 3 },
  { sequence: 'ENG', level_order: 4, headcount: 3 },
  { sequence: 'ENG', level_order: 5, headcount: 0 },
  { sequence: 'ENG', level_order: 6, headcount: 0 },
  // 工艺序列
  { sequence: 'OP', level_order: 1, headcount: 2 },
  { sequence: 'OP', level_order: 2, headcount: 2 },
  { sequence: 'OP', level_order: 3, headcount: 5 },
  { sequence: 'OP', level_order: 4, headcount: 3 },
  { sequence: 'OP', level_order: 5, headcount: 0 },
  { sequence: 'OP', level_order: 6, headcount: 0 },
  // 管理序列
  { sequence: 'MGT', level_order: 3, headcount: 6 },
  { sequence: 'MGT', level_order: 4, headcount: 5 },
  { sequence: 'MGT', level_order: 5, headcount: 3 },
  { sequence: 'MGT', level_order: 6, headcount: 1 },
  // 营销序列
  { sequence: 'SAL', level_order: 1, headcount: 1 },
  { sequence: 'SAL', level_order: 2, headcount: 2 },
  { sequence: 'SAL', level_order: 3, headcount: 3 },
  { sequence: 'SAL', level_order: 4, headcount: 1 },
  // 采购序列
  { sequence: 'PUR', level_order: 1, headcount: 1 },
  { sequence: 'PUR', level_order: 2, headcount: 2 },
  { sequence: 'PUR', level_order: 3, headcount: 2 },
  // HR 序列
  { sequence: 'HR', level_order: 1, headcount: 0 },
  { sequence: 'HR', level_order: 2, headcount: 1 },
  { sequence: 'HR', level_order: 3, headcount: 2 },
  // OPS 序列
  { sequence: 'OPS', level_order: 1, headcount: 0 },
  { sequence: 'OPS', level_order: 2, headcount: 1 },
  { sequence: 'OPS', level_order: 3, headcount: 2 },
];

/** 由 mock 员工实时计算缺口预测 */
function computeForecast(): GapForecastOut {
  const cfg = _mockConfig;

  // 在岗人数统计
  const activeMap: Record<string, number> = {};
  for (const e of mockEmployees) {
    const lvl = gradeToLevel(e.grade, e.sequence);
    if (lvl === null) continue;
    const key = `${e.sequence}:${lvl}`;
    activeMap[key] = (activeMap[key] || 0) + 1;
  }

  // 梯队储备：低一级人数的 30% 视为可向高一级流动的 pool
  const poolMap: Record<string, number> = {};
  for (const key of Object.keys(activeMap)) {
    const [seq, lvlStr] = key.split(':');
    const lvl = parseInt(lvlStr, 10);
    if (lvl < 6) {
      const higherKey = `${seq}:${lvl + 1}`;
      poolMap[higherKey] = (poolMap[higherKey] || 0) + Math.floor((activeMap[key] || 0) * 0.3);
    }
  }

  // 合并所有 keys
  const allKeys = new Set([
    ..._mockStandards.map((r) => `${r.sequence}:${r.level_order}`),
    ...Object.keys(activeMap),
  ]);

  const cells: GapCellOut[] = [];
  for (const key of allKeys) {
    const [seq, lvlStr] = key.split(':');
    const lvl = parseInt(lvlStr, 10);
    const demand = _mockStandards.find((r) => r.sequence === seq && r.level_order === lvl)?.headcount ?? 0;
    const active = activeMap[key] || 0;
    const pool = poolMap[key] || 0;

    // pool 按就绪度分布加权（简化假设：20% L1 / 30% L2 / 50% L3）
    const avgFactor = cfg.factor_l1 * 0.2 + cfg.factor_l2 * 0.3 + cfg.factor_l3 * 0.5;
    const supplyTotal = active + pool * avgFactor;
    const gap = supplyTotal - demand;

    let severity = 'balanced';
    if (gap < -0.5) severity = 'shortage';
    else if (gap > 0.5) severity = 'surplus';

    cells.push({
      sequence: seq,
      level_order: lvl,
      level_name: LEVEL_NAMES[lvl - 1] ?? null,
      demand,
      supply_active: active,
      supply_pool: pool,
      supply_total: Math.round(supplyTotal * 10) / 10,
      gap: Math.round(gap * 10) / 10,
      severity,
    });
  }

  cells.sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence.localeCompare(b.sequence);
    return a.level_order - b.level_order;
  });

  const totalDemand = cells.reduce((s, c) => s + c.demand, 0);
  const totalSupply = cells.reduce((s, c) => s + c.supply_total, 0);
  const shortageCells = cells.filter((c) => c.severity === 'shortage').length;
  const surplusCells = cells.filter((c) => c.severity === 'surplus').length;

  const unmappedEmployees = mockEmployees.filter((e) => gradeToLevel(e.grade, e.sequence) === null);
  const unmappedGrades = [...new Set(unmappedEmployees.map((e) => e.grade))];

  return {
    cells,
    unmapped: {
      count: unmappedEmployees.length,
      grades: unmappedGrades,
    },
    config: { ...cfg },
    summary: {
      total_demand: totalDemand,
      total_supply: Math.round(totalSupply * 10) / 10,
      total_gap: Math.round((totalSupply - totalDemand) * 10) / 10,
      shortage_cells: shortageCells,
      surplus_cells: surplusCells,
    },
  };
}

// ============ API ============

export const structureGapApi = {
  getForecast: (): Promise<GapForecastOut> => {
    if (USE_MOCK) return Promise.resolve(computeForecast());
    return api.get<GapForecastOut>('/structure/gap-forecast');
  },

  getHeadcountStandards: (): Promise<HeadcountRowOut[]> => {
    if (USE_MOCK) return Promise.resolve([..._mockStandards]);
    return api.get<HeadcountRowOut[]>('/structure/headcount-standards');
  },

  updateHeadcountStandards: (body: HeadcountStandardsIn): Promise<HeadcountRowOut[]> => {
    if (USE_MOCK) {
      _mockStandards = [...body.rows];
      return Promise.resolve([..._mockStandards]);
    }
    return api.put<HeadcountRowOut[]>('/structure/headcount-standards', body);
  },

  getGapConfig: (): Promise<GapConfigOut> => {
    if (USE_MOCK) return Promise.resolve({ ..._mockConfig });
    return api.get<GapConfigOut>('/structure/gap-config');
  },

  updateGapConfig: (body: GapConfigIn): Promise<GapConfigOut> => {
    if (USE_MOCK) {
      _mockConfig = { ...body, is_default: false };
      return Promise.resolve({ ..._mockConfig });
    }
    return api.put<GapConfigOut>('/structure/gap-config', body);
  },
};

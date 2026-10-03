/** 人才盘点接口（spec talent-matching §5.2）。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { employees as mockEmployees } from '@/mock/people';
import { batches as mockBatches, resultsOfBatch, GRID_CELLS } from '@/mock/inventory';

export type InvStatus = 'DRAFT' | 'CALIBRATING' | 'CONFIRMING' | 'PUBLISHED';
export type InvPurpose = 'ANNUAL' | 'SUCCESSION' | 'SALARY' | 'DEVELOPMENT';

export interface BatchOut {
  id: string;
  name: string;
  purpose: string;
  status: string;
  owner_id: string;
  scope_employee_ids: string[] | null;
  created_at: string;
  published_at: string | null;
}

export interface ResultOut {
  id: string;
  employee_id: string;
  perf_label: string | null;
  ability_score: number | null;
  potential: string | null;
  grid_code: string | null;
  located: boolean;
  calibrate_note: string | null;
}

export interface DistributionOut {
  total: number;
  unlocated: number;
  grids: Record<string, number>;
  percentages: Record<string, number>;
}

/** 员工跨批次轨迹点（对应后端 TrackPointOut） */
export interface TrackPoint {
  batch_id: string;
  batch_name: string;
  published_at: string | null;
  grid_code: string | null;
  potential: string | null;
  perf_label: string | null;
}

const MOCK_OWNER = 'E10002';

/** 模块级缓存：盘点批次列表，多页面共享 */
let _batchCache: Promise<BatchOut[]> | null = null;

function mockBatchToDTO(b: typeof mockBatches[number]): BatchOut {
  return {
    id: b.id,
    name: b.name,
    purpose: b.purpose,
    status: b.status,
    owner_id: MOCK_OWNER,
    scope_employee_ids: null,
    created_at: b.startedAt,
    published_at: b.status === 'PUBLISHED' ? b.startedAt : null,
  };
}

/** 后端枚举值为小写（annual / draft 等），前端 UI 常量统一用大写，这里归一化 */
function normalizeBatch(b: BatchOut): BatchOut {
  return {
    ...b,
    purpose: b.purpose?.toUpperCase(),
    status: b.status?.toUpperCase(),
  };
}

function mockResultToDTO(r: ReturnType<typeof resultsOfBatch>[number]): ResultOut {
  const potential =
    r.potentialScore >= 85 ? 'high' : r.potentialScore >= 65 ? 'mid' : 'low';
  return {
    id: `${r.batchId}-${r.employeeId}`,
    employee_id: r.employeeId,
    perf_label: null,
    ability_score: r.abilityScore,
    potential,
    grid_code: r.grid,
    located: true,
    calibrate_note: r.calibrateNote ?? null,
  };
}

/** mock 轨迹：按员工绩效/潜力确定性生成三个历史落点（保持演示丰满度） */
function mockTracks(employeeId: string): TrackPoint[] {
  const e = mockEmployees.find((x) => x.id === employeeId);
  if (!e) return [];
  const shift = (code: string, dx: number, dy: number) => {
    const cols = ['A', 'B', 'C'];
    const ci = Math.max(0, Math.min(2, cols.indexOf(code[1]) + dx));
    const ri = Math.max(1, Math.min(3, Number(code[2]) + dy));
    return `9${cols[ci]}${ri}`;
  };
  const ROW_POTENTIAL: Record<number, string> = { 1: 'high', 2: 'mid', 3: 'low' };
  const toPoint = (batchId: string, batchName: string, publishedAt: string, grid: string): TrackPoint => ({
    batch_id: batchId,
    batch_name: batchName,
    published_at: publishedAt,
    grid_code: grid,
    potential: ROW_POTENTIAL[Number(grid[2])],
    perf_label: e.perf,
  });
  const now = e.grid;
  return [
    toPoint(
      'mock_track_2024', '2024 年度盘点', '2024-11-30T00:00:00+08:00',
      shift(now, e.potential === 'HIGH' ? 0 : 1, e.potential === 'HIGH' ? 1 : 0),
    ),
    toPoint(
      'mock_track_2025', '2025 年度盘点', '2025-11-30T00:00:00+08:00',
      shift(now, e.perf === 'S' ? 0 : 1, 0),
    ),
    toPoint('mock_track_2026h1', '2026 半年度', '2026-06-30T00:00:00+08:00', now),
  ];
}

export const inventoryApi = {
  list: () => {
    if (USE_MOCK) return Promise.resolve(mockBatches.map(mockBatchToDTO));
    if (!_batchCache) {
      _batchCache = api.get<BatchOut[]>('/inventory-batches').then((rows) => rows.map(normalizeBatch));
    }
    return _batchCache;
  },
  /** 刷新批次列表缓存（创建/状态变更后调用） */
  invalidateBatches: () => { _batchCache = null; },
  get: (batchId: string) => {
    if (USE_MOCK) {
      const b = mockBatches.find((x) => x.id === batchId);
      if (!b) return Promise.reject(new Error('not found'));
      return Promise.resolve(mockBatchToDTO(b));
    }
    return api.get<BatchOut>(`/inventory-batches/${batchId}`).then(normalizeBatch);
  },
  create: (name: string, purpose: string, scope_employee_ids?: string[]) => {
    if (USE_MOCK) {
      const b = {
        id: `inv_${Date.now()}`, name, purpose: purpose as InvPurpose, status: 'DRAFT' as InvStatus,
        startedAt: new Date().toISOString().slice(0, 10),
        deadline: '', dimensionConfig: { perf: 0.4, ability: 0.3, potential: 0.3 },
        scopeDeptIds: [] as string[], estCount: 0, confirmedCount: 0, owner: 'mock',
      };
      mockBatches.push(b);
      return Promise.resolve(mockBatchToDTO(b));
    }
    return api
      .post<BatchOut>('/inventory-batches', { name, purpose, scope_employee_ids })
      .then(normalizeBatch);
  },
  start: (batchId: string) => {
    if (USE_MOCK) {
      const b = mockBatches.find((x) => x.id === batchId);
      if (b) (b.status as InvStatus) = 'CALIBRATING';
      return Promise.resolve(mockBatchToDTO(b!));
    }
    return api.post<BatchOut>(`/inventory-batches/${batchId}/start`).then(normalizeBatch);
  },
  results: (batchId: string) => {
    if (USE_MOCK) return Promise.resolve(resultsOfBatch(batchId).map(mockResultToDTO));
    return api.get<ResultOut[]>(`/inventory-batches/${batchId}/results`);
  },
  calibrate: (
    batchId: string,
    employeeId: string,
    body: { potential?: string; grid_code?: string; note?: string },
  ) => {
    if (USE_MOCK) return Promise.resolve({} as ResultOut);
    return api.put<ResultOut>(`/inventory-batches/${batchId}/results/${employeeId}`, body);
  },
  submitCalibration: (batchId: string) => {
    if (USE_MOCK) {
      const b = mockBatches.find((x) => x.id === batchId);
      return Promise.resolve(mockBatchToDTO(b!));
    }
    return api.post<BatchOut>(`/inventory-batches/${batchId}/submit-calibration`).then(normalizeBatch);
  },
  confirm: (batchId: string) => {
    if (USE_MOCK) {
      const b = mockBatches.find((x) => x.id === batchId);
      if (b) (b.status as InvStatus) = 'PUBLISHED';
      return Promise.resolve(mockBatchToDTO(b!));
    }
    return api.post<BatchOut>(`/inventory-batches/${batchId}/confirm`).then(normalizeBatch);
  },
  reject: (batchId: string) => {
    if (USE_MOCK) {
      const b = mockBatches.find((x) => x.id === batchId);
      if (b) (b.status as InvStatus) = 'DRAFT';
      return Promise.resolve(mockBatchToDTO(b!));
    }
    return api.post<BatchOut>(`/inventory-batches/${batchId}/reject`).then(normalizeBatch);
  },
  distribution: (batchId: string) => {
    if (USE_MOCK) {
      const results = resultsOfBatch(batchId);
      const grids: Record<string, number> = {};
      for (const c of GRID_CELLS) grids[c.code] = 0;
      for (const r of results) grids[r.grid] = (grids[r.grid] ?? 0) + 1;
      const total = results.length;
      const percentages: Record<string, number> = {};
      for (const c of GRID_CELLS)
        percentages[c.code] = total ? Math.round((grids[c.code] / total) * 100) : 0;
      return Promise.resolve({
        total, unlocated: 0, grids, percentages,
      } as DistributionOut);
    }
    return api.get<DistributionOut>(`/inventory-batches/${batchId}/distribution`);
  },
  /** 员工跨已发布批次的九宫格轨迹 */
  tracks: (employeeId: string) => {
    if (USE_MOCK) return Promise.resolve(mockTracks(employeeId));
    return api.get<TrackPoint[]>(`/inventory-tracks/${employeeId}`);
  },
};

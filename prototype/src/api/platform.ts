/**
 * 平台运营 API：租户管理 + 运营看板（仅 platform_admin）。
 * 契约对齐 backend/app/schemas/saas.py 的 TenantOut/TenantUpdate/PlatformDashboard。
 */
import { api } from './client';
import { USE_MOCK } from './config';

// ============ 类型 ============
export type TenantStatus = 'active' | 'trial' | 'suspended';

export interface TenantOut {
  id: string;
  name: string;
  status: TenantStatus;
  industry: string | null;
  plan_name: string | null;
  seats: number;
  mrr: number;
  health: number;
  joined_at: string | null;
}

export interface TenantUpdate {
  status?: TenantStatus;
  plan_name?: string | null;
  seats?: number;
  health?: number;
}

export interface MrrTrendPoint {
  month: string;
  mrr: number;
  new_tenants: number;
}

export interface DistItem { name: string; value: number; }

export interface PlatformDashboard {
  total_tenants: number;
  paying_tenants: number;
  trial_tenants: number;
  suspended: number;
  mrr: number;
  paid_seats: number;
  new_tenants_this_month: number;
  trial_conversion: number;
  mrr_trend: MrrTrendPoint[];
  industry_dist: DistItem[];
  plan_dist: DistItem[];
  risky_tenants: TenantOut[];
}

// ============ Mock 数据 ============
const MOCK_TENANTS: TenantOut[] = [
  { id: 'T001', name: '华砺精工', status: 'active', industry: '制造', plan_name: '专业版', seats: 43, mrr: 5547, health: 92, joined_at: '2026-03-18' },
  { id: 'T002', name: '恒远机械', status: 'active', industry: '制造', plan_name: '标准版', seats: 128, mrr: 8832, health: 88, joined_at: '2026-02-05' },
  { id: 'T003', name: '云帆科技', status: 'active', industry: '科技', plan_name: '专业版', seats: 86, mrr: 11094, health: 95, joined_at: '2026-01-22' },
  { id: 'T004', name: '悦客连锁', status: 'active', industry: '零售', plan_name: '标准版', seats: 210, mrr: 14490, health: 79, joined_at: '2025-12-10' },
  { id: 'T005', name: '中拓贸易', status: 'active', industry: '大宗贸易', plan_name: '专业版', seats: 64, mrr: 8256, health: 84, joined_at: '2026-04-02' },
  { id: 'T006', name: '启明智造', status: 'trial', industry: '制造', plan_name: '免费试用', seats: 35, mrr: 0, health: 61, joined_at: '2026-09-12' },
  { id: 'T007', name: '绿源新材料', status: 'trial', industry: '制造', plan_name: '标准版', seats: 52, mrr: 3588, health: 72, joined_at: '2026-08-28' },
  { id: 'T008', name: '卓信电子', status: 'suspended', industry: '科技', plan_name: '标准版', seats: 41, mrr: 0, health: 38, joined_at: '2026-05-15' },
];

const MOCK_DASHBOARD: PlatformDashboard = {
  total_tenants: 126,
  paying_tenants: 98,
  trial_tenants: 24,
  suspended: 4,
  mrr: 682000,
  paid_seats: 8420,
  new_tenants_this_month: 11,
  trial_conversion: 34,
  mrr_trend: [
    { month: '2026-04', mrr: 426000, new_tenants: 2 },
    { month: '2026-05', mrr: 488000, new_tenants: 3 },
    { month: '2026-06', mrr: 542000, new_tenants: 1 },
    { month: '2026-07', mrr: 610000, new_tenants: 4 },
    { month: '2026-08', mrr: 651000, new_tenants: 2 },
    { month: '2026-09', mrr: 682000, new_tenants: 3 },
  ],
  industry_dist: [
    { name: '制造', value: 46 },
    { name: '科技', value: 24 },
    { name: '零售', value: 14 },
    { name: '大宗贸易', value: 10 },
    { name: '其他', value: 6 },
  ],
  plan_dist: [
    { name: '免费试用', value: 24 },
    { name: '标准版', value: 52 },
    { name: '专业版', value: 44 },
    { name: '企业版', value: 6 },
  ],
  risky_tenants: MOCK_TENANTS.slice().sort((a, b) => a.health - b.health).slice(0, 4),
};

// ============ API ============
export const platformApi = {
  listTenants: (status?: TenantStatus): Promise<TenantOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_TENANTS.filter((t) => !status || t.status === status));
    return api.get('/platform/tenants', { status });
  },

  updateTenant: (id: string, body: TenantUpdate): Promise<TenantOut> => {
    if (USE_MOCK) {
      const t = MOCK_TENANTS.find((x) => x.id === id)!;
      return Promise.resolve({ ...t, ...body });
    }
    return api.put(`/platform/tenants/${id}`, body);
  },

  suspendTenant: (id: string): Promise<TenantOut> => {
    if (USE_MOCK) {
      const t = MOCK_TENANTS.find((x) => x.id === id)!;
      return Promise.resolve({ ...t, status: 'suspended' });
    }
    return api.post(`/platform/tenants/${id}/suspend`);
  },

  restoreTenant: (id: string): Promise<TenantOut> => {
    if (USE_MOCK) {
      const t = MOCK_TENANTS.find((x) => x.id === id)!;
      return Promise.resolve({ ...t, status: 'active' });
    }
    return api.post(`/platform/tenants/${id}/restore`);
  },

  getDashboard: (): Promise<PlatformDashboard> => {
    if (USE_MOCK) return Promise.resolve(MOCK_DASHBOARD);
    return api.get('/platform/dashboard');
  },
};

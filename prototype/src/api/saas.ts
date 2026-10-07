/**
 * SaaS 运营 API：套餐/账单/AI 用量/模板市场/配置中心。
 * 契约对齐 backend/app/schemas/saas.py。
 */
import { api } from './client';
import { USE_MOCK } from './config';

// ============ 套餐 ============
export interface PlanOut {
  id: string;
  name: string;
  scope: string;
  billing: string;
  price: string;
  sort_order: number;
}

// ============ 账单 ============
export type BillStatus = 'paid' | 'pending' | 'overdue';
export interface BillIn {
  period: string;
  plan_name: string;
  seats?: number;
  seat_cost?: number;
  ai_cost?: number;
  total?: number;
  status?: BillStatus;
}
export interface BillOut {
  id: string;
  period: string;
  plan_name: string;
  seats: number;
  seat_cost: number;
  ai_cost: number;
  total: number;
  status: BillStatus;
}

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  paid: '已支付', pending: '待支付', overdue: '逾期',
};
export const PLAN_COLOR: Record<string, string> = {
  免费试用: 'var(--ink-3)', 标准版: 'var(--teal)', 专业版: 'var(--clay)', 企业版: 'var(--charcoal)',
};

// ============ AI 用量 ============
export interface AiUsageOut {
  id: string;
  created_at: string;
  scene: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  operator: string | null;
}
export interface AiQuotaOut {
  monthly_token_quota: number;
  month_used_tokens: number;
  month_calls: number;
  month_cost: number;
  over_strategy: string;
  usage_pct: number;
}
export interface AiTrendPoint { month: string; tokens: number; cost: number; }

export const SCENE_COLOR: Record<string, string> = {
  出题: '#3b6e8f', 归因: '#d4a843', 问答: '#5b8db0', 预审: '#5fa88a', 画像: '#8a6db0', IDP: '#c45a5a',
};

// ============ 模板市场 ============
export interface TemplatePackOut {
  id: string;
  name: string;
  industry: string;
  version: string;
  standards_count: number;
  rating: number;
  installs: number;
  status: string;
  desc: string;
  installed: boolean;
  active: boolean;
}

export const INDUSTRY_COLOR: Record<string, string> = {
  制造: 'var(--clay)', 科技: 'var(--teal)', 零售: 'var(--ochre)',
  大宗贸易: 'var(--sage)', 通用: 'var(--ink-3)', 医疗: 'var(--danger)',
};

// ============ 配置中心 ============
export type ConfigStatus = 'active' | 'draft';
export interface ConfigItemOut {
  id: string;
  group: string;
  template_value: string;
  override_value: string;
  note: string;
  status: ConfigStatus;
  customized: boolean;
  updated_at: string;
}
export interface ConfigItemUpdate {
  override_value?: string;
  note?: string;
  status?: ConfigStatus;
}

// ============ Mock 数据 ============
const MOCK_PLANS: PlanOut[] = [
  { id: 'PL0', name: '免费试用', scope: '画像 + 基础盘点', billing: '限额内免费', price: '¥0', sort_order: 0 },
  { id: 'PL1', name: '标准版', scope: '任职资格 + 绩效 + 十大应用', billing: '按员工席位订阅', price: '¥69 / 席位·月', sort_order: 1 },
  { id: 'PL2', name: '专业版', scope: 'AI 能力 + 高级报表/驾驶舱', billing: '席位 + AI 用量', price: '¥129 / 席位·月', sort_order: 2 },
  { id: 'PL3', name: '企业版', scope: '独立实例/私有化、SSO、定制', billing: '年度合同 + 实施费', price: '洽谈', sort_order: 3 },
];
const MOCK_BILLS: BillOut[] = [
  { id: 'BL01', period: '2026-09', plan_name: '专业版', seats: 43, seat_cost: 5547, ai_cost: 286.4, total: 5833.4, status: 'pending' },
  { id: 'BL02', period: '2026-08', plan_name: '专业版', seats: 42, seat_cost: 5418, ai_cost: 252.0, total: 5670.0, status: 'paid' },
  { id: 'BL03', period: '2026-07', plan_name: '专业版', seats: 41, seat_cost: 5289, ai_cost: 214.0, total: 5503.0, status: 'paid' },
  { id: 'BL04', period: '2026-06', plan_name: '专业版', seats: 40, seat_cost: 5160, ai_cost: 168.0, total: 5328.0, status: 'paid' },
];
const MOCK_USAGE: AiUsageOut[] = [
  { id: 'AU01', created_at: '2026-09-27T10:12:00Z', scene: '出题', model: '豆包-pro', input_tokens: 8600, output_tokens: 4200, cost: 0.082, operator: '系统自动（考试中心）' },
  { id: 'AU02', created_at: '2026-09-27T09:40:00Z', scene: '问答', model: 'Kimi', input_tokens: 12400, output_tokens: 3100, cost: 0.076, operator: '沈既明 · 驾驶舱问答' },
  { id: 'AU03', created_at: '2026-09-26T16:05:00Z', scene: '归因', model: '豆包-pro', input_tokens: 15600, output_tokens: 5800, cost: 0.124, operator: '系统自动（盘点校准）' },
  { id: 'AU04', created_at: '2026-09-26T14:22:00Z', scene: '画像', model: '智谱 GLM-4', input_tokens: 21000, output_tokens: 6400, cost: 0.198, operator: '系统自动（画像引擎）' },
  { id: 'AU05', created_at: '2026-09-25T11:30:00Z', scene: '预审', model: '豆包-pro', input_tokens: 9800, output_tokens: 2600, cost: 0.071, operator: '温晚晴 · 认证材料预审' },
  { id: 'AU06', created_at: '2026-09-25T10:02:00Z', scene: 'IDP', model: '通义-plus', input_tokens: 7600, output_tokens: 3900, cost: 0.064, operator: '许星遥 · IDP 建议' },
];
const MOCK_QUOTA: AiQuotaOut = {
  monthly_token_quota: 50_000_000, month_used_tokens: 31_200_000,
  month_calls: 18420, month_cost: 286.4, over_strategy: '熔断或降级为规则引擎兜底', usage_pct: 62,
};
const MOCK_TREND: AiTrendPoint[] = [
  { month: '4 月', tokens: 12.4, cost: 98 },
  { month: '5 月', tokens: 15.8, cost: 132 },
  { month: '6 月', tokens: 19.2, cost: 168 },
  { month: '7 月', tokens: 24.6, cost: 214 },
  { month: '8 月', tokens: 28.1, cost: 252 },
  { month: '9 月', tokens: 31.2, cost: 286 },
];
const MOCK_TEMPLATES: TemplatePackOut[] = [
  { id: 'TP01', name: '制造行业任职资格包', industry: '制造', version: 'v2.1', standards_count: 86, rating: 4.9, installs: 1240, status: 'on', desc: '覆盖研发/工艺/操作/职能全序列，含带宽与调薪规则建议值', installed: true, active: true },
  { id: 'TP02', name: '高新科技（软硬件）包', industry: '科技', version: 'v2.0', standards_count: 74, rating: 4.8, installs: 860, status: 'on', desc: 'P/T 双族细分，适配研发驱动型组织', installed: false, active: false },
  { id: 'TP03', name: '零售连锁运营包', industry: '零售', version: 'v1.6', standards_count: 52, rating: 4.6, installs: 540, status: 'on', desc: '门店运营、采购与督导序列，含排班绩效规则', installed: false, active: false },
  { id: 'TP04', name: '大宗贸易业务包', industry: '大宗贸易', version: 'v1.4', standards_count: 46, rating: 4.5, installs: 320, status: 'on', desc: '业务/风控/物流三族，适配贸易型企业', installed: false, active: false },
  { id: 'TP05', name: '通用职能基础包', industry: '通用', version: 'v3.0', standards_count: 38, rating: 4.7, installs: 1580, status: 'on', desc: 'HR/财务/行政职能序列，可与任意行业包叠加', installed: true, active: false },
  { id: 'TP06', name: '医疗服务试行包', industry: '医疗', version: 'v0.9', standards_count: 41, rating: 4.2, installs: 68, status: 'off', desc: '试运行版本，暂未正式上架', installed: false, active: false },
];
const MOCK_CONFIG: ConfigItemOut[] = [
  { id: 'CFG1', group: '任职资格标准', template_value: '制造行业包 v2.1', override_value: '华砺个性化版本 v2.3（软件序列扩 6 级）', note: '行业模板导入后按自身岗位修订', status: 'active', customized: true, updated_at: '2026-08-12' },
  { id: 'CFG2', group: '认证路由', template_value: 'P1→P2 经理；P2→P3 小组；P3+ 管委会', override_value: '', note: '评审组织与门槛按职级/序列配置', status: 'active', customized: false, updated_at: '2026-07-01' },
  { id: 'CFG3', group: '强制分布', template_value: 'S 10% / A 25% / B 45% / C 15% / D 5%', override_value: 'S 8% / A 27% / B 46% / C 14% / D 5%', note: '各等级比例按年度策略调整', status: 'active', customized: true, updated_at: '2026-09-05' },
  { id: 'CFG4', group: '复评周期', template_value: 'P4/P5 三年一复评', override_value: '', note: '高等级定义与复评周期可配', status: 'active', customized: false, updated_at: '2026-07-01' },
  { id: 'CFG5', group: '调薪规则', template_value: '核心岗位+核心人才、75 分位停涨', override_value: '内部公平分 ≥40 入选；绩效门槛 85 分', note: '内部公平/外部竞争阈值与筛选条件', status: 'active', customized: true, updated_at: '2026-09-10' },
  { id: 'CFG6', group: '出题档位', template_value: '了解→选择；掌握→填空；熟练掌握→问答；精通→答辩', override_value: '', note: '知识四档与题型映射', status: 'active', customized: false, updated_at: '2026-07-01' },
  { id: 'CFG7', group: 'AI 模型与配额', template_value: '默认豆包-pro · 月配额 50M tokens', override_value: '出题场景灰度 30% 走智谱 GLM-4', note: '草稿未生效；超限降级规则引擎兜底', status: 'draft', customized: true, updated_at: '2026-09-24' },
];

// ============ API ============
export const saasApi = {
  // 套餐
  listPlans: (): Promise<PlanOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_PLANS);
    return api.get('/saas/plans');
  },

  // 账单
  listBills: (): Promise<BillOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_BILLS);
    return api.get('/saas/bills');
  },
  createBill: (body: BillIn): Promise<BillOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_BILLS[0], id: `b_${Date.now()}`, ...body });
    return api.post('/saas/bills', body);
  },
  payBill: (id: string): Promise<BillOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_BILLS[0], id, status: 'paid' });
    return api.post(`/saas/bills/${id}/pay`);
  },

  // AI 用量
  listAiUsage: (scene?: string): Promise<AiUsageOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_USAGE.filter((u) => !scene || u.scene === scene));
    return api.get('/saas/ai/usage', { scene });
  },
  getAiQuota: (): Promise<AiQuotaOut> => {
    if (USE_MOCK) return Promise.resolve(MOCK_QUOTA);
    return api.get('/saas/ai/quota');
  },
  updateAiQuota: (body: { monthly_token_quota?: number; over_strategy?: string }): Promise<AiQuotaOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_QUOTA, ...body });
    return api.put('/saas/ai/quota', body);
  },
  getAiTrend: (months = 6): Promise<AiTrendPoint[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_TREND.slice(-months));
    return api.get('/saas/ai/trend', { months });
  },

  // 模板市场
  listTemplates: (): Promise<TemplatePackOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_TEMPLATES);
    return api.get('/saas/templates');
  },
  installTemplate: (id: string): Promise<TemplatePackOut> => {
    if (USE_MOCK) {
      const t = MOCK_TEMPLATES.find((x) => x.id === id)!;
      return Promise.resolve({ ...t, installed: true, active: true });
    }
    return api.post(`/saas/templates/${id}/install`);
  },
  uninstallTemplate: (id: string): Promise<void> => {
    if (USE_MOCK) return Promise.resolve();
    return api.delete(`/saas/templates/${id}/install`);
  },

  // 配置中心
  listConfig: (): Promise<ConfigItemOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_CONFIG);
    return api.get('/saas/config');
  },
  updateConfig: (id: string, body: ConfigItemUpdate): Promise<ConfigItemOut> => {
    if (USE_MOCK) {
      const c = MOCK_CONFIG.find((x) => x.id === id)!;
      return Promise.resolve({ ...c, ...body, customized: !!(body.override_value && body.override_value !== c.template_value) });
    }
    return api.put(`/saas/config/${id}`, body);
  },
};

/**
 * 批次 8 · SaaS 运营 mock
 * 规则来源 PRD「配置中心（SaaS 的灵魂）」「套餐与计费」「SaaS 化扩展表」：
 * 模板 + 租户覆盖；ai_usage 流水计费、配额限流；租户开通/封禁（平台不可见员工明文）。
 */

// ============ 配置中心：模板 + 租户覆盖 ============
export type ConfigStatus = 'active' | 'draft';

export interface ConfigItem {
  id: string;
  group: string;
  /** 模板默认值 */
  templateValue: string;
  /** 租户覆盖值 */
  overrideValue: string;
  customized: boolean;
  updatedAt: string;
  status: ConfigStatus;
  note: string;
}

export const configItems: ConfigItem[] = [
  { id: 'CFG1', group: '任职资格标准', templateValue: '制造行业包 v2.1', overrideValue: '华砺个性化版本 v2.3（软件序列扩 6 级）', customized: true, updatedAt: '2026-08-12', status: 'active', note: '行业模板导入后按自身岗位修订' },
  { id: 'CFG2', group: '认证路由', templateValue: 'P1→P2 经理；P2→P3 小组；P3+ 管委会', overrideValue: '同模板（未覆盖）', customized: false, updatedAt: '2026-07-01', status: 'active', note: '评审组织与门槛按职级/序列配置' },
  { id: 'CFG3', group: '强制分布', templateValue: 'S 10% / A 25% / B 45% / C 15% / D 5%', overrideValue: 'S 8% / A 27% / B 46% / C 14% / D 5%', customized: true, updatedAt: '2026-09-05', status: 'active', note: '各等级比例按年度策略调整' },
  { id: 'CFG4', group: '复评周期', templateValue: 'P4/P5 三年一复评', overrideValue: '同模板（未覆盖）', customized: false, updatedAt: '2026-07-01', status: 'active', note: '高等级定义与复评周期可配' },
  { id: 'CFG5', group: '调薪规则', templateValue: '核心岗位+核心人才、75 分位停涨', overrideValue: '内部公平分 ≥40 入选；绩效门槛 85 分', customized: true, updatedAt: '2026-09-10', status: 'active', note: '内部公平/外部竞争阈值与筛选条件' },
  { id: 'CFG6', group: '出题档位', templateValue: '了解→选择；掌握→填空；熟练掌握→问答；精通→答辩', overrideValue: '同模板（未覆盖）', customized: false, updatedAt: '2026-07-01', status: 'active', note: '知识四档与题型映射' },
  { id: 'CFG7', group: 'AI 模型与配额（草稿）', templateValue: '默认豆包-pro · 月配额 50M tokens', overrideValue: '出题场景灰度 30% 走智谱 GLM-4', customized: true, updatedAt: '2026-09-24', status: 'draft', note: '草稿未生效；超限降级规则引擎兜底' },
];

// ============ 模板市场 ============
export interface TemplatePack {
  id: string;
  name: string;
  industry: string;
  version: string;
  standards: number;
  rating: number;
  installs: number;
  installed?: boolean;
  active?: boolean;
  status: 'on' | 'off';
  updatedAt: string;
  desc: string;
}

export const templatePacks: TemplatePack[] = [
  { id: 'TP01', name: '制造行业任职资格包', industry: '制造', version: 'v2.1', standards: 86, rating: 4.9, installs: 1240, installed: true, active: true, status: 'on', updatedAt: '2026-07-15', desc: '覆盖研发/工艺/操作/职能全序列，含带宽与调薪规则建议值' },
  { id: 'TP02', name: '高新科技（软硬件）包', industry: '科技', version: 'v2.0', standards: 74, rating: 4.8, installs: 860, status: 'on', updatedAt: '2026-07-01', desc: 'P/T 双族细分，适配研发驱动型组织' },
  { id: 'TP03', name: '零售连锁运营包', industry: '零售', version: 'v1.6', standards: 52, rating: 4.6, installs: 540, status: 'on', updatedAt: '2026-05-20', desc: '门店运营、采购与督导序列，含排班绩效规则' },
  { id: 'TP04', name: '大宗贸易业务包', industry: '大宗贸易', version: 'v1.4', standards: 46, rating: 4.5, installs: 320, status: 'on', updatedAt: '2026-04-10', desc: '业务/风控/物流三族，适配贸易型企业' },
  { id: 'TP05', name: '通用职能基础包', industry: '通用', version: 'v3.0', standards: 38, rating: 4.7, installs: 1580, installed: true, status: 'on', updatedAt: '2026-08-01', desc: 'HR/财务/行政职能序列，可与任意行业包叠加' },
  { id: 'TP06', name: '医疗服务试行包', industry: '医疗', version: 'v0.9', standards: 41, rating: 4.2, installs: 68, status: 'off', updatedAt: '2026-03-15', desc: '试运行版本，暂未正式上架' },
];

// ============ AI 用量流水 ============
export type AiScene = '出题' | '归因' | '问答' | '预审' | '画像' | 'IDP';

export interface AiUsageRow {
  id: string;
  time: string;
  scene: AiScene;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  operator: string;
}

export const aiUsageRows: AiUsageRow[] = [
  { id: 'AU01', time: '2026-09-27 10:12', scene: '出题', model: '豆包-pro', inputTokens: 8600, outputTokens: 4200, cost: 0.082, operator: '系统自动（考试中心）' },
  { id: 'AU02', time: '2026-09-27 09:40', scene: '问答', model: 'Kimi', inputTokens: 12400, outputTokens: 3100, cost: 0.076, operator: '沈既明 · 驾驶舱问答' },
  { id: 'AU03', time: '2026-09-26 16:05', scene: '归因', model: '豆包-pro', inputTokens: 15600, outputTokens: 5800, cost: 0.124, operator: '系统自动（盘点校准）' },
  { id: 'AU04', time: '2026-09-26 14:22', scene: '画像', model: '智谱 GLM-4', inputTokens: 21000, outputTokens: 6400, cost: 0.198, operator: '系统自动（画像引擎）' },
  { id: 'AU05', time: '2026-09-25 11:30', scene: '预审', model: '豆包-pro', inputTokens: 9800, outputTokens: 2600, cost: 0.071, operator: '温晚晴 · 认证材料预审' },
  { id: 'AU06', time: '2026-09-25 10:02', scene: 'IDP', model: '通义-plus', inputTokens: 7600, outputTokens: 3900, cost: 0.064, operator: '许云清 · IDP 建议' },
  { id: 'AU07', time: '2026-09-24 17:48', scene: '出题', model: '智谱 GLM-4', inputTokens: 11200, outputTokens: 5100, cost: 0.118, operator: '系统自动（灰度 30%）' },
  { id: 'AU08', time: '2026-09-24 15:10', scene: '归因', model: '豆包-pro', inputTokens: 14300, outputTokens: 4900, cost: 0.109, operator: '系统自动（绩效归因）' },
];

/** 本租户配额与月累计 */
export const aiQuota = {
  monthlyTokenQuota: 50_000_000,
  monthUsedTokens: 31_200_000,
  monthCalls: 18420,
  monthCost: 286.4,
  /** 超限策略 */
  overStrategy: '熔断或降级为规则引擎兜底',
};

/** 近 6 个月用量趋势（tokens, 百万） */
export const aiUsageTrend = [
  { month: '4 月', tokens: 12.4, cost: 98 },
  { month: '5 月', tokens: 15.8, cost: 132 },
  { month: '6 月', tokens: 19.2, cost: 168 },
  { month: '7 月', tokens: 24.6, cost: 214 },
  { month: '8 月', tokens: 28.1, cost: 252 },
  { month: '9 月', tokens: 31.2, cost: 286 },
];

// ============ 套餐与账单 ============
export interface Plan {
  id: string;
  name: string;
  scope: string;
  billing: string;
  price: string;
  current?: boolean;
}

export const plans: Plan[] = [
  { id: 'PL0', name: '免费试用', scope: '画像 + 基础盘点', billing: '限额内免费', price: '¥0' },
  { id: 'PL1', name: '标准版', scope: '任职资格 + 绩效 + 十大应用', billing: '按员工席位订阅', price: '¥69 / 席位·月' },
  { id: 'PL2', name: '专业版', scope: 'AI 能力 + 高级报表/驾驶舱', billing: '席位 + AI 用量', price: '¥129 / 席位·月', current: true },
  { id: 'PL3', name: '企业版', scope: '独立实例/私有化、SSO、定制', billing: '年度合同 + 实施费', price: '洽谈' },
];

export interface Bill {
  id: string;
  period: string;
  plan: string;
  seats: number;
  aiCost: number;
  total: number;
  status: '已支付' | '待支付' | '逾期';
}

export const bills: Bill[] = [
  { id: 'BL01', period: '2026-09', plan: '专业版', seats: 43, aiCost: 286.4, total: 5833.4, status: '待支付' },
  { id: 'BL02', period: '2026-08', plan: '专业版', seats: 42, aiCost: 252.0, total: 5670.0, status: '已支付' },
  { id: 'BL03', period: '2026-07', plan: '专业版', seats: 41, aiCost: 214.0, total: 5503.0, status: '已支付' },
  { id: 'BL04', period: '2026-06', plan: '专业版', seats: 40, aiCost: 168.0, total: 5328.0, status: '已支付' },
];

// ============ 平台 · 租户管理（不可见员工明文） ============
export type TenantStatus = 'active' | 'trial' | 'suspended';

export interface TenantRow {
  id: string;
  name: string;
  industry: string;
  plan: string;
  seats: number;
  status: TenantStatus;
  mrr: number;
  joinedAt: string;
  health: number;
}

export const platformTenants: TenantRow[] = [
  { id: 'T001', name: '华砺精工', industry: '制造', plan: '专业版', seats: 43, status: 'active', mrr: 5547, joinedAt: '2026-03-18', health: 92 },
  { id: 'T002', name: '恒远机械', industry: '制造', plan: '标准版', seats: 128, status: 'active', mrr: 8832, joinedAt: '2026-02-05', health: 88 },
  { id: 'T003', name: '云帆科技', industry: '科技', plan: '专业版', seats: 86, status: 'active', mrr: 11094, joinedAt: '2026-01-22', health: 95 },
  { id: 'T004', name: '悦客连锁', industry: '零售', plan: '标准版', seats: 210, status: 'active', mrr: 14490, joinedAt: '2025-12-10', health: 79 },
  { id: 'T005', name: '中拓贸易', industry: '大宗贸易', plan: '专业版', seats: 64, status: 'active', mrr: 8256, joinedAt: '2026-04-02', health: 84 },
  { id: 'T006', name: '启明智造', industry: '制造', plan: '免费试用', seats: 35, status: 'trial', mrr: 0, joinedAt: '2026-09-12', health: 61 },
  { id: 'T007', name: '绿源新材料', industry: '制造', plan: '标准版', seats: 52, status: 'trial', mrr: 3588, joinedAt: '2026-08-28', health: 72 },
  { id: 'T008', name: '卓信电子', industry: '科技', plan: '标准版', seats: 41, status: 'suspended', mrr: 0, joinedAt: '2026-05-15', health: 38 },
];

// ============ 平台 · 运营看板 ============
export const platformKpi = {
  totalTenants: 126,
  payingTenants: 98,
  trialTenants: 24,
  suspended: 4,
  mrr: 682000,
  paidSeats: 8420,
  monthlyTokens: 4200,
  newTenantsThisMonth: 11,
  trialConversion: 34,
};

/** MRR 近 6 个月（万元） */
export const mrrTrend = [
  { month: '4 月', mrr: 42.6 },
  { month: '5 月', mrr: 48.2 },
  { month: '6 月', mrr: 53.8 },
  { month: '7 月', mrr: 59.1 },
  { month: '8 月', mrr: 64.3 },
  { month: '9 月', mrr: 68.2 },
];

/** 行业分布 */
export const industryDist = [
  { name: '制造', value: 46 },
  { name: '科技', value: 24 },
  { name: '零售', value: 14 },
  { name: '大宗贸易', value: 10 },
  { name: '其他', value: 6 },
];

/** 套餐分布 */
export const planDist = [
  { name: '免费试用', value: 24 },
  { name: '标准版', value: 52 },
  { name: '专业版', value: 44 },
  { name: '企业版', value: 6 },
];

/**
 * 批次 7 · 薪酬管理 mock
 * 等级工资表 / 市场分位 / 调薪引擎（确定性规则）/ 调薪审批 / 薪酬套改
 * 规则来源 PRD 模块八：年底调薪只给核心岗位上的核心人才；
 * 内部公平性（低薪高能优先）+ 外部竞争性（75 分位停涨）；
 * 套改先结论 → 抛问题 → 数据 → 2–3 套方案。
 */
import { employees } from './people';

const r100 = (v: number) => Math.round(v / 100) * 100;

// ============ 市场分位数据（美世 2026 · 华东制造/高新 混合样本，月薪口径） ============
export interface MarketRow {
  sequence: string;
  sequenceName: string;
  grade: string;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  source: string;
  updatedAt: string;
}

export const marketData: MarketRow[] = [
  { sequence: 'SW', sequenceName: '软件研发序列', grade: 'P2', p25: 12000, p50: 14500, p75: 18000, p90: 21000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'SW', sequenceName: '软件研发序列', grade: 'P3', p25: 19000, p50: 25000, p75: 30000, p90: 36000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'SW', sequenceName: '软件研发序列', grade: 'P4', p25: 28000, p50: 34000, p75: 42000, p90: 50000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'ENG', sequenceName: '机械工程序列', grade: 'P3', p25: 20000, p50: 25000, p75: 31000, p90: 37000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'ENG', sequenceName: '机械工程序列', grade: 'P4', p25: 30000, p50: 36000, p75: 44000, p90: 52000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'OP', sequenceName: '工艺操作序列', grade: 'T2', p25: 9500, p50: 12000, p75: 15000, p90: 18000, source: '怡安 2026', updatedAt: '2026-06-15' },
  { sequence: 'OP', sequenceName: '工艺操作序列', grade: 'T3', p25: 16000, p50: 20000, p75: 25000, p90: 30000, source: '怡安 2026', updatedAt: '2026-06-15' },
  { sequence: 'OP', sequenceName: '工艺操作序列', grade: 'T4', p25: 24000, p50: 30000, p75: 37000, p90: 44000, source: '怡安 2026', updatedAt: '2026-06-15' },
  { sequence: 'SAL', sequenceName: '销售序列', grade: 'S3', p25: 24000, p50: 32000, p75: 42000, p90: 52000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'O', sequenceName: '职能序列', grade: 'O3', p25: 14000, p50: 18000, p75: 23000, p90: 28000, source: '怡安 2026', updatedAt: '2026-06-15' },
  { sequence: 'MGT', sequenceName: '管理序列', grade: 'M2', p25: 31000, p50: 40000, p75: 50000, p90: 62000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'MGT', sequenceName: '管理序列', grade: 'M3', p25: 40000, p50: 50000, p75: 60000, p90: 74000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'MGT', sequenceName: '管理序列', grade: 'M4', p25: 58000, p50: 72000, p75: 88000, p90: 105000, source: '美世 2026', updatedAt: '2026-07-01' },
  { sequence: 'MGT', sequenceName: '管理序列', grade: 'M5', p25: 90000, p50: 110000, p75: 135000, p90: 160000, source: '美世 2026', updatedAt: '2026-07-01' },
];

/** 序列归类：PUR/HR/OPS 等职能并入 O 序列查分位 */
export function marketOf(sequence: string, grade: string): MarketRow | undefined {
  const seq = grade.startsWith('O') ? 'O' : sequence;
  return marketData.find((m) => m.sequence === seq && m.grade === grade);
}

/** 分位定位：p25–p90 分段线性插值，返回 5–99 */
export function percentileOf(salary: number, row: MarketRow): number {
  const pts: [number, number][] = [[row.p25, 25], [row.p50, 50], [row.p75, 75], [row.p90, 90]];
  if (salary <= pts[0][0]) return Math.max(5, Math.round((salary / pts[0][0]) * 25));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    if (salary <= x2) return Math.round(y1 + ((salary - x1) / (x2 - x1)) * (y2 - y1));
  }
  return Math.min(99, Math.round(90 + ((salary - pts[3][0]) / pts[3][0]) * 10));
}

// ============ 等级工资表：带宽 = 市场 P50 锚定，M 序列宽带 ============
export interface GradeBand {
  grade: string;
  min: number;
  mid: number;
  max: number;
  /** 5 档薪档 */
  tiers: number[];
}

export function bandOf(sequence: string, grade: string): GradeBand | undefined {
  const m = marketOf(sequence, grade);
  if (!m) return undefined;
  const wide = grade.startsWith('M');
  const min = r100(m.p50 * (wide ? 0.75 : 0.78));
  const max = r100(m.p50 * (wide ? 1.35 : 1.28));
  return {
    grade,
    min,
    mid: r100((min + max) / 2),
    max,
    tiers: Array.from({ length: 5 }, (_, i) => r100(min + ((max - min) * i) / 4)),
  };
}

/** 工资表覆盖的全部序列（按市场数据去重） */
export function coveredSequences(): { sequence: string; name: string; grades: string[] }[] {
  const map = new Map<string, string[]>();
  for (const m of marketData) {
    const list = map.get(m.sequence) ?? [];
    if (!list.includes(m.grade)) list.push(m.grade);
    map.set(m.sequence, list);
  }
  return [...map.entries()].map(([sequence, grades]) => ({
    sequence,
    name: marketData.find((m) => m.sequence === sequence)!.sequenceName,
    grades,
  }));
}

// ============ 调薪引擎（确定性规则，可解释） ============
export type AdjustAction = 'UP' | 'FREEZE' | 'STOP';

export interface AdjustSuggestion {
  id: string;
  employeeId: string;
  name: string;
  dept: string;
  position: string;
  grade: string;
  isCore: boolean;
  perfScore: number;
  /** 内部公平分 25–98，越高 = 相对同职级越低薪（低薪高能优先） */
  internalEquityScore: number;
  /** 当前市场分位，≥75 停涨 */
  marketPercentile: number;
  oldSalary: number;
  action: AdjustAction;
  suggestPct: number;
  newSalary: number;
  reason: string;
}

export const ADJUST_BATCH = '2026 年初调薪';
/** 年度调薪预算（新增年化人力成本） */
export const ANNUAL_BUDGET = 600000;

function groupMedian(e: { sequence: string; grade: string }): number {
  const peers = employees
    .filter((p) => p.sequence === e.sequence && p.grade === e.grade)
    .map((p) => p.salary)
    .sort((a, b) => a - b);
  const mid = Math.floor(peers.length / 2);
  return peers.length % 2 ? peers[mid] : (peers[mid - 1] + peers[mid]) / 2;
}

/** 调薪建议引擎：核心岗位 × 绩效 ≥ 85 → 内部公平分 + 市场分位 → UP / FREEZE / STOP */
export function adjustSuggestions(): AdjustSuggestion[] {
  const pool = employees.filter((e) => e.isCorePosition && e.perfScore >= 85);
  const out: AdjustSuggestion[] = [];
  pool.forEach((e, i) => {
    const row = marketOf(e.sequence, e.grade);
    if (!row) return;
    const pct = percentileOf(e.salary, row);
    const median = groupMedian(e);
    const gap = 1 - e.salary / median; // >0 低薪
    const equity = Math.round(Math.min(98, Math.max(25, 60 + gap * 200)));
    const step = e.perfScore >= 95 ? 10 : e.perfScore >= 90 ? 8 : 6;
    let action: AdjustAction;
    let reason: string;
    if (pct >= 75) {
      action = 'STOP';
      reason = `市场分位 ${pct}% ≥ 75%，触发外部竞争性停涨`;
    } else if (equity <= 30) {
      action = 'FREEZE';
      reason = `绩效 ${e.perfScore} 分达标，但薪酬高于同职级中位 ${Math.round(-gap * 100)}%，内部公平性冻结本周期`;
    } else {
      action = 'UP';
      const pos = gap > 0.03 ? '低于同职级中位，低薪高能优先' : gap < -0.03 ? '略高于同职级中位' : '位处同职级中位';
      reason = `核心岗位核心人才；绩效 ${e.perfScore} 分；内部公平分 ${equity}（${pos}）；市场分位 ${pct}% 未到 75 停涨线`;
    }
    const capped = Math.min(r100(e.salary * (1 + step / 100)), r100(row.p75));
    out.push({
      id: `AS${String(i + 1).padStart(3, '0')}`,
      employeeId: e.id,
      name: e.name,
      dept: e.deptId,
      position: e.position,
      grade: e.grade,
      isCore: e.isCorePosition,
      perfScore: e.perfScore,
      internalEquityScore: equity,
      marketPercentile: pct,
      oldSalary: e.salary,
      action,
      suggestPct: action === 'UP' ? step : 0,
      newSalary: action === 'UP' ? capped : e.salary,
      reason,
    });
  });
  return out.sort((a, b) => b.internalEquityScore - a.internalEquityScore);
}

/** 年新增成本（月增 × 12） */
export function budgetOf(list: AdjustSuggestion[]): number {
  return list.reduce((s, x) => s + (x.newSalary - x.oldSalary) * 12, 0);
}

// ============ 调薪审批（状态机：0 建议 → 1 审批中 → 2 通过 / 3 驳回） ============
export interface ApprovalRecord {
  id: string;
  batch: string;
  employeeId: string;
  /** annual 年度调薪 / promotion 晋升联动（岗变薪变） */
  kind: 'annual' | 'promotion';
  oldGrade: string;
  newGrade: string;
  oldSalary: number;
  newSalary: number;
  marketPercentile?: number;
  status: 1 | 2 | 3;
  submittedAt: string;
  decidedAt?: string;
  decider?: string;
  rejectReason?: string;
}

export const approvalPending: ApprovalRecord[] = [
  { id: 'AR001', batch: ADJUST_BATCH, employeeId: 'E10101', kind: 'annual', oldGrade: 'P4', newGrade: 'P4', oldSalary: 38000, newSalary: 41800, marketPercentile: 56, status: 1, submittedAt: '2026-09-20' },
  { id: 'AR002', batch: ADJUST_BATCH, employeeId: 'E10087', kind: 'annual', oldGrade: 'P4', newGrade: 'P4', oldSalary: 36000, newSalary: 38880, marketPercentile: 56, status: 1, submittedAt: '2026-09-20' },
  { id: 'AR003', batch: ADJUST_BATCH, employeeId: 'E10002', kind: 'annual', oldGrade: 'M3', newGrade: 'M3', oldSalary: 52000, newSalary: 56160, marketPercentile: 55, status: 1, submittedAt: '2026-09-20' },
  { id: 'AR004', batch: ADJUST_BATCH, employeeId: 'E10111', kind: 'annual', oldGrade: 'T4', newGrade: 'T4', oldSalary: 31000, newSalary: 33480, marketPercentile: 54, status: 1, submittedAt: '2026-09-20' },
];

export const approvalHistory: ApprovalRecord[] = [
  { id: 'AR101', batch: '2025 年度调薪', employeeId: 'E10088', kind: 'annual', oldGrade: 'P4', newGrade: 'P4', oldSalary: 34000, newSalary: 36040, marketPercentile: 50, status: 2, submittedAt: '2025-12-10', decidedAt: '2025-12-18', decider: '张澜' },
  { id: 'AR102', batch: '2026-08 晋升联动', employeeId: 'E10104', kind: 'promotion', oldGrade: 'P3', newGrade: 'P4', oldSalary: 24000, newSalary: 29000, status: 2, submittedAt: '2026-08-15', decidedAt: '2026-08-22', decider: '张澜' },
  { id: 'AR103', batch: '2026-08 晋升联动', employeeId: 'E10092', kind: 'promotion', oldGrade: 'P3', newGrade: 'P4', oldSalary: 27000, newSalary: 32000, status: 2, submittedAt: '2026-08-15', decidedAt: '2026-08-22', decider: '张澜' },
  { id: 'AR104', batch: '2025 年度调薪', employeeId: 'E10004', kind: 'annual', oldGrade: 'M2', newGrade: 'M2', oldSalary: 32000, newSalary: 34560, marketPercentile: 48, status: 3, submittedAt: '2025-12-10', decidedAt: '2025-12-20', decider: '张澜', rejectReason: '非核心岗位，不符合「年度调薪仅覆盖核心岗位核心人才」规则' },
];

// ============ 薪酬套改：先结论 → 抛问题 → 数据 → 2–3 套方案 ============
export const settleConclusion =
  '建议采用方案 B「就低套改 + 过渡补贴」：以新工资表就低入档、差额以两年过渡补贴补齐，总成本增幅最小、老员工零降薪、认证晋升通道不受影响，是震荡与成本的最优平衡。';

export const settleQuestions = [
  { q: '带宽下沿的老员工怎么处理？', detail: '多为一职多能的老师傅与早期入职员工，直接套低将引发离职风险，需过渡保护。' },
  { q: '一刀切套改还是分步套改？', detail: '一刀切信号清晰但当月成本跳升；分步套改成本平滑，但两次沟通成本高。' },
  { q: '套改后认证晋升是否重置薪档？', detail: '建议晋升联动只晋档不重置，保留套改前累计薪龄，避免与认证体系冲突。' },
];

export interface SettleOption {
  id: string;
  name: string;
  tagline: string;
  monthlyCost: string;
  affected: string;
  pros: string[];
  cons: string[];
  recommended?: boolean;
}

export const settleOptions: SettleOption[] = [
  {
    id: 'A',
    name: '方案 A · 就高套改',
    tagline: '一律就靠近的更高薪档入档',
    monthlyCost: '+¥86,000 / 月',
    affected: '43 人全部上浮，其中 17 人跨档',
    pros: ['一步到位，员工感知最强', '为后续招聘留出带宽空间'],
    cons: ['年成本增幅超预算 43%', '内部公平性倒挂风险'],
  },
  {
    id: 'B',
    name: '方案 B · 就低套改 + 过渡补贴',
    tagline: '就低入档，差额以 24 个月补贴补齐',
    monthlyCost: '+¥52,000 / 月（含补贴 ¥18,000）',
    affected: '43 人零降薪，带宽下沿员工享过渡补贴',
    pros: ['成本可控，预算内可消化', '过渡期满自动并入档内，无需二次沟通'],
    cons: ['前两年员工「到手感」弱于方案 A', '补贴规则需在沟通中讲透'],
    recommended: true,
  },
  {
    id: 'C',
    name: '方案 C · 分步套改',
    tagline: '两次套改各走一半，跨两个年度',
    monthlyCost: '+¥69,000 / 月（分两年到位）',
    affected: '43 人分两轮，明年 3 月复核',
    pros: ['成本两年摊薄', '给认证晋级留出衔接窗口'],
    cons: ['两次全员沟通，HR 承载重', '政策窗口期存在变数'],
  },
];

/**
 * 人才盘点 mock —— 盘点批次、九宫格、三张图、人才结构、断层预警、液态组队。
 * 维度对齐 PRD：业绩（过去）× 能力（现在）× 潜力（未来）→ 九宫格。
 * 九宫格坐标 9{业绩列}{潜力行}：列 A=高/B=中/C=低；行 1=高/2=中/3=低。
 */
import type { Employee } from '@/types';
import { employees } from '@/mock/people';
import { latestProfile } from '@/mock/profiles';
import { deptName, subtreeDeptIds, positions } from '@/mock/org';

// ============ 盘点批次 ============
export type InvStatus = 'DRAFT' | 'RUNNING' | 'PUBLISHED';
export type InvPurpose = 'ANNUAL' | 'SUCCESSION' | 'SALARY' | 'DEVELOPMENT';

export const INV_STATUS_LABEL: Record<InvStatus, string> = {
  DRAFT: '草稿',
  RUNNING: '进行中',
  PUBLISHED: '已发布',
};

export const INV_PURPOSE_LABEL: Record<InvPurpose, string> = {
  ANNUAL: '年度盘点',
  SUCCESSION: '继任盘点',
  SALARY: '调薪盘点',
  DEVELOPMENT: '发展盘点',
};

export interface InventoryBatch {
  id: string;
  name: string;
  purpose: InvPurpose;
  status: InvStatus;
  startedAt: string;
  deadline: string;
  /** 维度权重：perf/ability/potential */
  dimensionConfig: { perf: number; ability: number; potential: number };
  scopeDeptIds: string[];
  /** 预计覆盖人数 */
  estCount: number;
  /** 当前确认进度 */
  confirmedCount: number;
  owner: string;
}

export const batches: InventoryBatch[] = [
  {
    id: 'inv_2025_annual',
    name: '2025 年度人才盘点',
    purpose: 'ANNUAL',
    status: 'PUBLISHED',
    startedAt: '2025-09-01',
    deadline: '2025-11-30',
    dimensionConfig: { perf: 0.4, ability: 0.3, potential: 0.3 },
    scopeDeptIds: ['100'],
    estCount: 650,
    confirmedCount: 650,
    owner: '周敏',
  },
  {
    id: 'inv_2026_h1',
    name: '2026 半年度盘点（研发中心）',
    purpose: 'SUCCESSION',
    status: 'RUNNING',
    startedAt: '2026-09-10',
    deadline: '2026-10-30',
    dimensionConfig: { perf: 0.35, ability: 0.35, potential: 0.3 },
    scopeDeptIds: ['305', '306', '307'],
    estCount: 36,
    confirmedCount: 12,
    owner: '周敏',
  },
  {
    id: 'inv_2026_annual',
    name: '2026 年度人才盘点',
    purpose: 'ANNUAL',
    status: 'DRAFT',
    startedAt: '2026-10-15',
    deadline: '2026-12-31',
    dimensionConfig: { perf: 0.4, ability: 0.3, potential: 0.3 },
    scopeDeptIds: ['100'],
    estCount: 650,
    confirmedCount: 0,
    owner: '周敏',
  },
];

export function batchById(id: string): InventoryBatch | undefined {
  return batches.find((b) => b.id === id);
}

// ============ 九宫格 ============
export interface GridCell {
  code: string; // 9A1
  col: 'A' | 'B' | 'C'; // 业绩列
  row: 1 | 2 | 3; // 潜力行
  label: string;
  strategy: string;
  color: string;
}

export const GRID_CELLS: GridCell[] = [
  { code: '9A1', col: 'A', row: 1, label: '明星', strategy: '重点培养：纳入梯队、给核心项目、加速晋升通道', color: '#d96a8e' },
  { code: '9A2', col: 'A', row: 2, label: '核心骨干', strategy: '保留激励：调薪倾斜、关键岗位匹配、避免倦怠', color: '#e3be6b' },
  { code: '9A3', col: 'A', row: 3, label: '业绩之星', strategy: '留用激励：保持业绩、补能力短板、转专家路线', color: '#7fb5d6' },
  { code: '9B1', col: 'B', row: 1, label: '潜力股', strategy: '培养辅导：补业绩、给挑战任务、配导师', color: '#7fc49b' },
  { code: '9B2', col: 'B', row: 2, label: '中坚力量', strategy: '稳定发展：维持节奏、横向拓展、阶梯晋升', color: '#a099aa' },
  { code: '9B3', col: 'B', row: 3, label: '待改进', strategy: '绩效改进：设 PIP、3 个月复盘、不行转岗/降级', color: '#de7066' },
  { code: '9C1', col: 'C', row: 1, label: '问题员工', strategy: '意愿干预：面谈找原因、调岗激发、保留观察', color: '#e89a90' },
  { code: '9C2', col: 'C', row: 2, label: '待发展', strategy: '补知识：IDP 聚焦能力短板、培训+实践', color: '#c9c2d0' },
  { code: '9C3', col: 'C', row: 3, label: '淘汰区', strategy: '退出：转岗/降薪/协商解除，严控占比', color: '#de7066' },
];

export const GRID_DIM_PAIRS = [
  { key: 'perf_potential', label: '业绩 × 潜力' },
  { key: 'perf_ability', label: '业绩 × 能力' },
] as const;

/** 由员工数据推导九宫格定位（列=业绩，行=潜力） */
export function gridOf(e: Employee): string {
  const col: 'A' | 'B' | 'C' = e.perf === 'S' || e.perf === 'A' ? 'A' : e.perf === 'B' ? 'B' : 'C';
  const row: 1 | 2 | 3 = e.potential === 'HIGH' ? 1 : e.potential === 'MID' ? 2 : 3;
  return `9${col}${row}`;
}

/** 盘点结果（三维打分 + 定位 + 策略） */
export interface InventoryResult {
  employeeId: string;
  batchId: string;
  perfScore: number; // 业绩
  abilityScore: number; // 能力
  potentialScore: number; // 潜力
  grid: string;
  strategy: string;
  /** 是否校准中 */
  calibrating?: boolean;
  /** 校准理由 */
  calibrateNote?: string;
}

export function resultsOfBatch(batchId: string): InventoryResult[] {
  return employees.map((e) => {
    const profile = latestProfile(e.id);
    const perfScore = e.perfScore;
    const abilityScore = Math.round(
      (profile.dims.ability.score + profile.dims.duty.score) / 2,
    );
    const potentialScore =
      e.potential === 'HIGH' ? 88 : e.potential === 'MID' ? 70 : 52;
    const grid = gridOf(e);
    const cell = GRID_CELLS.find((c) => c.code === grid)!;
    return {
      employeeId: e.id,
      batchId,
      perfScore,
      abilityScore,
      potentialScore,
      grid,
      strategy: cell.strategy,
    };
  });
}

/** 九宫格按格分组统计 */
export function gridDistribution(results: InventoryResult[]) {
  const map = new Map<string, InventoryResult[]>();
  for (const c of GRID_CELLS) map.set(c.code, []);
  for (const r of results) map.get(r.grid)?.push(r);
  return map;
}

// ============ 三张图 ============
export interface ThreeCharts {
  year: number;
  strategy: { initiative: string; talentSupport: number; owner: string; note: string }[];
  org: { departments: number; keyPositions: number; successionCoverage: number; orgChanges: number };
  talent: {
    p4PlusRatio: number;
    highPotentialCount: number;
    riskCount: number;
    /** 能力×业绩散点：{empId, x: perfScore, y: abilityScore, size: potential} */
    scatter: { empId: string; x: number; y: number; size: number }[];
    willingnessAnomaly: string[]; // 能力强业绩差→意愿度异常的员工
  };
}

export const threeCharts: ThreeCharts = {
  year: 2026,
  strategy: [
    { initiative: '降本增效', talentSupport: 86, owner: '李卫国', note: '供应链+工艺联合降本，核心由 T/M 序列承接' },
    { initiative: '海外建厂', talentSupport: 54, owner: '马德海', note: '缺懂当地法规的运营+质量复合型人才' },
    { initiative: '数字化转型', talentSupport: 78, owner: '高启明', note: '软件研发承接，P3→P4 中坚需加速' },
    { initiative: '新产品线扩张', talentSupport: 62, owner: '沈一楠', note: '销服+研发协同，销售 S3→S4 储备不足' },
  ],
  org: {
    departments: 19,
    keyPositions: positions.filter((p) => p.isCore).length,
    successionCoverage: 0.62,
    orgChanges: 3,
  },
  talent: {
    p4PlusRatio: 0.42,
    highPotentialCount: employees.filter((e) => e.potential === 'HIGH').length,
    riskCount: employees.filter((e) => e.risk === 'HIGH').length,
    scatter: employees.map((e) => {
      const profile = latestProfile(e.id);
      return {
        empId: e.id,
        x: e.perfScore,
        y: Math.round((profile.dims.ability.score + profile.dims.duty.score) / 2),
        size: e.potential === 'HIGH' ? 18 : e.potential === 'MID' ? 12 : 8,
      };
    }),
    // 能力强但业绩差 → 意愿度异常
    willingnessAnomaly: employees
      .filter((e) => {
        const p = latestProfile(e.id);
        const ability = (p.dims.ability.score + p.dims.duty.score) / 2;
        return ability >= 75 && e.perfScore < 78;
      })
      .map((e) => e.id),
  },
};

// ============ 人才结构 ============
export interface DeptStructure {
  deptId: string;
  deptName: string;
  headcount: number;
  /** 职级 → 人数 */
  gradeCount: Record<string, number>;
  /** 结构类型 */
  shape: 'dumbbell' | 'diamond' | 'healthy' | 'pyramid';
  shapeLabel: string;
  /** 中坚层（P3/M2/T3/O3/S3 及相邻）占比 */
  midRatio: number;
}

/** 判断结构类型：哑铃(中间薄)、菱形(中间厚>50%)、健康金字塔 */
function shapeOf(gradeCount: Record<string, number>): DeptStructure['shape'] {
  const counts = Object.values(gradeCount);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 'healthy';
  const grades = Object.keys(gradeCount).sort();
  const midIdx = Math.floor(grades.length / 2);
  const midKeys = grades.slice(Math.max(0, midIdx - 1), midIdx + 2);
  const midCount = midKeys.reduce((s, k) => s + (gradeCount[k] ?? 0), 0);
  const midRatio = midCount / total;
  const lowCount = (gradeCount[grades[0]] ?? 0);
  const highCount = (gradeCount[grades[grades.length - 1]] ?? 0);
  // 哑铃：两端高、中间薄
  if (lowCount > 0 && highCount > 0 && midRatio < 0.4) return 'dumbbell';
  if (midRatio > 0.5) return 'diamond';
  if (lowCount >= midCount && midCount >= highCount) return 'pyramid';
  return 'healthy';
}

const SHAPE_LABEL: Record<DeptStructure['shape'], string> = {
  dumbbell: '哑铃型 ⚠️',
  diamond: '菱形',
  pyramid: '金字塔型',
  healthy: '均衡型',
};

export function deptStructures(): DeptStructure[] {
  // 按一级部门聚合（300 研发 / 400 制造 / 500 供应链 / 600 营销 / 200 职能）
  const topDepts = ['200', '300', '400', '500', '600'];
  return topDepts.map((top) => {
    const ids = new Set(subtreeDeptIds(top));
    const list = employees.filter((e) => ids.has(e.deptId));
    const gradeCount: Record<string, number> = {};
    for (const e of list) gradeCount[e.grade] = (gradeCount[e.grade] ?? 0) + 1;
    const shape = shapeOf(gradeCount);
    const grades = Object.keys(gradeCount).sort();
    const midIdx = Math.floor(grades.length / 2);
    const midKeys = grades.slice(Math.max(0, midIdx - 1), midIdx + 2);
    const midCount = midKeys.reduce((s, k) => s + (gradeCount[k] ?? 0), 0);
    return {
      deptId: top,
      deptName: deptName(top),
      headcount: list.length,
      gradeCount,
      shape,
      shapeLabel: SHAPE_LABEL[shape],
      midRatio: list.length ? midCount / list.length : 0,
    };
  });
}

// ============ 断层预警 ============
export interface GapWarning {
  positionId: string;
  positionName: string;
  deptName: string;
  incumbentId: string;
  incumbentName: string;
  /** 风险等级：核心岗位无继任 / 继任准备度不足 / 流失风险 */
  level: 'HIGH' | 'MID' | 'LOW';
  reason: string;
  /** 补位建议 */
  suggestion: string;
}

export const gapWarnings: GapWarning[] = [
  {
    positionId: 'p004',
    positionName: '高级软件工程师',
    deptName: '软件研发部',
    incumbentId: 'E10087',
    incumbentName: '陈昊',
    level: 'HIGH',
    reason: '核心岗位 4 个编制，目前仅 2 人在岗（陈昊、刘洋）；中坚 P3→P4 通过率不足，且 1 人有 MID 流失风险',
    suggestion: '加速 P3→P4 认证（林一凡/冯雪）；启动外部招聘；对陈昊启动保留面谈',
  },
  {
    positionId: 'p001',
    positionName: '首席执行官',
    deptName: '华砺精工',
    incumbentId: 'E10001',
    incumbentName: '张澜',
    level: 'MID',
    reason: '一把手无明确继任者，高启明/周敏为潜在候选但未做正式培养',
    suggestion: '明确 1-2 名继任候选人，纳入管委会培养计划，半年盘点一次',
  },
  {
    positionId: 'p013',
    positionName: '车间主任',
    deptName: '机加车间',
    incumbentId: 'E10051',
    incumbentName: '钱满仓',
    level: 'MID',
    reason: '钱满仓司龄 16 年、潜力 LOW，已到复评期；车间无 B 角',
    suggestion: '配置 B 角（范进/钟志强），制定继任培养计划；复评关注',
  },
  {
    positionId: 'p018',
    positionName: '大客户经理',
    deptName: '销售部',
    incumbentId: 'E10161',
    incumbentName: '秦朗',
    level: 'HIGH',
    reason: '销冠一人贡献占部门 35%，无 S3→S4 梯队，单岗风险极高',
    suggestion: '启动 S4 继任（白玲/秦朗内部）+ 外部猎聘；客户资源共享化',
  },
];

// ============ 液态组队 ============
export interface LiquidProject {
  id: string;
  name: string;
  deptName: string;
  /** 需要的能力项 */
  needs: { ability: string; level: number }[];
  deadline: string;
  status: 'forming' | 'running';
}

export interface TeamCandidate {
  employeeId: string;
  name: string;
  position: string;
  matchScore: number;
  willingness: 'high' | 'mid' | 'low';
  readiness: 'ready' | '6m' | '1y';
  reason: string;
}

export const liquidProjects: LiquidProject[] = [
  {
    id: 'proj_digital',
    name: '数字化转型专项（MES 二期）',
    deptName: '研发中心',
    needs: [
      { ability: '系统思维', level: 3 },
      { ability: '数据结构与算法', level: 3 },
      { ability: '协同推进', level: 2 },
    ],
    deadline: '2026-12-31',
    status: 'forming',
  },
  {
    id: 'proj_overseas',
    name: '海外建厂筹备组',
    deptName: '制造中心',
    needs: [
      { ability: '系统思维', level: 3 },
      { ability: '客户导向', level: 3 },
    ],
    deadline: '2027-03-31',
    status: 'forming',
  },
];

/** 按项目能力要求匹配候选队员（mock：用画像 ability 维度打分） */
export function matchCandidates(project: LiquidProject): TeamCandidate[] {
  const ABILITY_KEY: Record<string, string> = {
    系统思维: 'ability',
    数据结构与算法: 'knowledge',
    协同推进: 'ability',
    客户导向: 'ability',
  };
  return employees
    .filter((e) => e.family === 'P' || e.family === 'T' || e.family === 'M')
    .map((e) => {
      const profile = latestProfile(e.id);
      const total = project.needs.reduce((s, n) => {
        const k = ABILITY_KEY[n.ability];
        const have = k ? profile.dims[k].score : 70;
        // 所需等级 1-3 对应分数 60/75/90
        const required = 45 + n.level * 15;
        const match = Math.max(0, 100 - Math.abs(have - required));
        return s + match;
      }, 0);
      const matchScore = Math.round(total / project.needs.length);
      return {
        employeeId: e.id,
        name: e.name,
        position: e.position,
        matchScore,
        willingness: (e.risk === 'HIGH' ? 'low' : e.potential === 'HIGH' ? 'high' : 'mid') as TeamCandidate['willingness'],
        readiness: (matchScore >= 80 ? 'ready' : matchScore >= 65 ? '6m' : '1y') as TeamCandidate['readiness'],
        reason: matchScore >= 80 ? '能力匹配度高，可立即入组' : '需 1-2 项能力补强后入组',
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8) as TeamCandidate[];
}

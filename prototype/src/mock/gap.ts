/**
 * 批次 5 mock —— 差距分析、改进计划、人才初盘、学习地图、考试、IDP、辅导记录。
 * 规则对齐 PRD：差距类型→动作映射；杨三角优先级（意愿＞机制＞能力）；知识四档出题。
 */
import type { Employee } from '@/types';
import { employees } from '@/mock/people';
import { latestProfile } from '@/mock/profiles';
import { deptName } from '@/mock/org';

// ============ 差距分析 ============
export type GapDimension = 'perf' | 'duty' | 'ability' | 'contribution' | 'knowledge';
export type ActionRoute = 'perf_improvement' | 'process_supervision' | 'behavior_improve' | 'team_contribution' | 'learn_knowledge';

export const GAP_DIM_LABEL: Record<GapDimension, string> = {
  perf: '业绩',
  duty: '履职',
  ability: '能力',
  contribution: '团队贡献',
  knowledge: '知识',
};

export const ACTION_LABEL: Record<ActionRoute, string> = {
  perf_improvement: '绩效改进',
  process_supervision: '过程行为监督',
  behavior_improve: '行为改善',
  team_contribution: '做团队贡献',
  learn_knowledge: '学知识',
};

/** 差距维度 → 动作路由映射 */
export const DIM_TO_ACTION: Record<GapDimension, ActionRoute> = {
  perf: 'perf_improvement',
  duty: 'process_supervision',
  ability: 'behavior_improve',
  contribution: 'team_contribution',
  knowledge: 'learn_knowledge',
};

export const ACTION_COLOR: Record<ActionRoute, string> = {
  perf_improvement: 'var(--danger)',
  process_supervision: 'var(--ochre)',
  behavior_improve: 'var(--teal)',
  team_contribution: 'var(--sage)',
  learn_knowledge: 'var(--clay)',
};

export interface Gap {
  id: string;
  employeeId: string;
  dimension: GapDimension;
  detail: string;
  /** 标准要求 */
  standard: string;
  /** 现状 */
  current: string;
  severity: 'HIGH' | 'MID' | 'LOW';
  action: ActionRoute;
  /** 杨三角优先级：1 意愿 2 机制 3 能力 */
  priority: 1 | 2 | 3;
}

/** 生成某员工的差距清单（标准×现状比对） */
export function gapsOf(empId: string): Gap[] {
  const e = employees.find((x) => x.id === empId);
  if (!e) return [];
  const p = latestProfile(empId);
  const gaps: Gap[] = [];

  // 业绩：标准近一年 B 以上（≥80）
  if (e.perfScore < 80) {
    gaps.push({
      id: `${empId}_perf`,
      employeeId: empId,
      dimension: 'perf',
      detail: `业绩未达 B 级标准`,
      standard: '近一年绩效 B 级以上（≥80 分）',
      current: `${e.perf}（${e.perfScore} 分）`,
      severity: e.perfScore < 70 ? 'HIGH' : 'MID',
      action: 'perf_improvement',
      priority: 1,
    });
  }

  // 履职：标准 level 3，现状 duty.score
  const duty = p.dims.duty.score;
  if (duty < 75) {
    gaps.push({
      id: `${empId}_duty`,
      employeeId: empId,
      dimension: 'duty',
      detail: `岗位职责履职未达 ${e.grade} 级要求`,
      standard: `${e.grade} 级履职达标（≥75 分）`,
      current: `${duty} 分`,
      severity: duty < 60 ? 'HIGH' : 'MID',
      action: 'process_supervision',
      priority: 2,
    });
  }

  // 能力
  const ability = p.dims.ability.score;
  if (ability < 72) {
    gaps.push({
      id: `${empId}_ability`,
      employeeId: empId,
      dimension: 'ability',
      detail: `能力素质未达 ${e.grade} 级要求`,
      standard: `${e.grade} 级能力达标（≥72 分）`,
      current: `${ability} 分`,
      severity: ability < 60 ? 'HIGH' : 'LOW',
      action: 'behavior_improve',
      priority: 3,
    });
  }

  // 团队贡献
  const contrib = p.dims.contribution.score;
  if (contrib < 65) {
    gaps.push({
      id: `${empId}_contribution`,
      employeeId: empId,
      dimension: 'contribution',
      detail: '团队贡献不足',
      standard: '承担带教或技术分享（≥65 分）',
      current: `${contrib} 分`,
      severity: contrib < 50 ? 'HIGH' : 'MID',
      action: 'team_contribution',
      priority: 2,
    });
  }

  // 知识
  const knowledge = p.dims.knowledge.score;
  if (knowledge < 70) {
    gaps.push({
      id: `${empId}_knowledge`,
      employeeId: empId,
      dimension: 'knowledge',
      detail: '知识技能存在短板',
      standard: `${e.grade} 级知识达标（≥70 分）`,
      current: `${knowledge} 分`,
      severity: knowledge < 55 ? 'HIGH' : 'MID',
      action: 'learn_knowledge',
      priority: 3,
    });
  }

  return gaps.sort((a, b) => a.priority - b.priority);
}

/** 团队差距看板（按部门聚合的差距统计） */
export function teamGapBoard(deptId?: string) {
  const list = deptId ? employees.filter((e) => e.deptId === deptId) : employees;
  return list.map((e) => {
    const gaps = gapsOf(e.id);
    return {
      employeeId: e.id,
      name: e.name,
      position: e.position,
      deptName: deptName(e.deptId),
      gapCount: gaps.length,
      highCount: gaps.filter((g) => g.severity === 'HIGH').length,
      actions: Array.from(new Set(gaps.map((g) => g.action))),
      gaps,
    };
  });
}

// ============ 改进计划 ============
export interface ImprovementPlan {
  id: string;
  gapId: string;
  employeeId: string;
  title: string;
  action: ActionRoute;
  status: 'pending' | 'running' | 'done' | 'closed';
  startDate: string;
  endDate: string;
  progress: number;
  owner: string;
  manager: string;
}

export const improvementPlans: ImprovementPlan[] = [
  {
    id: 'ip_001', gapId: 'E10086_perf', employeeId: 'E10086',
    title: '许云清业绩提升计划', action: 'perf_improvement',
    status: 'running', startDate: '2026-07-01', endDate: '2026-09-30',
    progress: 60, owner: '许云清', manager: '陆行舟',
  },
  {
    id: 'ip_002', gapId: 'E10086_knowledge', employeeId: 'E10086',
    title: '许云清分布式知识补强', action: 'learn_knowledge',
    status: 'running', startDate: '2026-07-15', endDate: '2026-10-15',
    progress: 45, owner: '许云清', manager: '陆行舟',
  },
  {
    id: 'ip_003', gapId: 'E10051_duty', employeeId: 'E10051',
    title: '唐雨时履职过程监督', action: 'process_supervision',
    status: 'running', startDate: '2026-08-01', endDate: '2026-11-30',
    progress: 30, owner: '唐雨时', manager: '岑屿',
  },
  {
    id: 'ip_004', gapId: 'E10161_ability', employeeId: 'E10161',
    title: '秦越客户导向行为改善', action: 'behavior_improve',
    status: 'done', startDate: '2026-05-01', endDate: '2026-08-31',
    progress: 100, owner: '秦越', manager: '温既白',
  },
  {
    id: 'ip_005', gapId: 'E10093_contribution', employeeId: 'E10093',
    title: '温以宁团队贡献计划', action: 'team_contribution',
    status: 'pending', startDate: '2026-10-01', endDate: '2026-12-31',
    progress: 0, owner: '温以宁', manager: '陆行舟',
  },
];

export const STATUS_LABEL: Record<ImprovementPlan['status'], string> = {
  pending: '待启动', running: '进行中', done: '已完成', closed: '已关闭',
};

// ============ 人才初盘 ============
export interface InitialInventory {
  grade: string;
  headcount: number;
  /** 水平层级：达标/接近达标/需提升 */
  level: 'qualified' | 'near' | 'need_improve';
  ratio: number;
}

export function initialInventory(): InitialInventory[] {
  const gradeMap = new Map<string, Employee[]>();
  for (const e of employees) {
    const arr = gradeMap.get(e.grade) ?? [];
    arr.push(e);
    gradeMap.set(e.grade, arr);
  }
  const rows: InitialInventory[] = [];
  for (const [grade, list] of gradeMap) {
    const qualified = list.filter((e) => e.perfScore >= 80 && e.potential !== 'LOW').length;
    const ratio = qualified / list.length;
    const level = ratio >= 0.6 ? 'qualified' : ratio >= 0.3 ? 'near' : 'need_improve';
    rows.push({ grade, headcount: list.length, level, ratio });
  }
  return rows.sort((a, b) => a.grade.localeCompare(b.grade));
}

export const LEVEL_LABEL = { qualified: '达标', near: '接近达标', need_improve: '需提升' };

// ============ 学习地图 ============
export interface LearnMapItem {
  id: string;
  position: string;
  grade: string;
  courseName: string;
  /** 1 必修 2 选修 3 认证前置 */
  learnType: 1 | 2 | 3;
  /** 知识掌握层级 1 了解 2 掌握 3 熟练 4 精通 */
  mastery: 1 | 2 | 3 | 4;
  examMode: '选择' | '填空' | '问答' | '答辩';
  duration: string;
}

export const LEARN_TYPE_LABEL = { 1: '必修', 2: '选修', 3: '认证前置' };
export const MASTERY_LABEL = { 1: '了解', 2: '掌握', 3: '熟练掌握', 4: '精通' };

export const learnMap: LearnMapItem[] = [
  { id: 'lm1', position: '软件工程师', grade: 'P3', courseName: '数据结构与算法进阶', learnType: 1, mastery: 3, examMode: '问答', duration: '8 学时' },
  { id: 'lm2', position: '软件工程师', grade: 'P3', courseName: '分布式系统基础', learnType: 1, mastery: 2, examMode: '填空', duration: '12 学时' },
  { id: 'lm3', position: '软件工程师', grade: 'P3', courseName: 'Git / CI-CD 工具链', learnType: 1, mastery: 3, examMode: '问答', duration: '6 学时' },
  { id: 'lm4', position: '软件工程师', grade: 'P3', courseName: '信息安全合规基础', learnType: 2, mastery: 1, examMode: '选择', duration: '4 学时' },
  { id: 'lm5', position: '软件工程师', grade: 'P3', courseName: '系统架构设计', learnType: 3, mastery: 3, examMode: '问答', duration: '16 学时' },
  { id: 'lm6', position: '软件工程师', grade: 'P4', courseName: '微服务架构', learnType: 1, mastery: 4, examMode: '答辩', duration: '20 学时' },
  { id: 'lm7', position: '软件工程师', grade: 'P4', courseName: '高并发系统设计', learnType: 1, mastery: 3, examMode: '问答', duration: '16 学时' },
  { id: 'lm8', position: '机械工程师', grade: 'P3', courseName: '机械制图与公差', learnType: 1, mastery: 3, examMode: '填空', duration: '10 学时' },
  { id: 'lm9', position: '机械工程师', grade: 'P3', courseName: '材料力学', learnType: 1, mastery: 2, examMode: '问答', duration: '12 学时' },
  { id: 'lm10', position: '销售经理', grade: 'S3', courseName: '大客户销售策略', learnType: 1, mastery: 3, examMode: '问答', duration: '14 学时' },
];

// ============ 考试 ============
export interface ExamQuestion {
  id: string;
  type: 'choice' | 'fill' | 'qa';
  question: string;
  options?: string[];
  answer: string;
  score: number;
  mastery: 1 | 2 | 3 | 4;
}

export interface ExamPaper {
  id: string;
  title: string;
  position: string;
  grade: string;
  questions: ExamQuestion[];
  passScore: number;
  duration: number;
  aiGenerated: boolean;
  status: 'pending_review' | 'approved' | 'rejected';
}

export const examPapers: ExamPaper[] = [
  {
    id: 'exam_sw_p3',
    title: '软件工程师 P3 知识认证考试',
    position: '软件工程师',
    grade: 'P3',
    passScore: 70,
    duration: 60,
    aiGenerated: true,
    status: 'approved',
    questions: [
      { id: 'q1', type: 'choice', question: '以下哪种数据结构适合实现 LRU 缓存？', options: ['数组', '哈希表+双向链表', '栈', '队列'], answer: '哈希表+双向链表', score: 10, mastery: 2 },
      { id: 'q2', type: 'fill', question: '分布式系统中 CAP 定理指的是一致性、可用性和______。', answer: '分区容错性', score: 10, mastery: 2 },
      { id: 'q3', type: 'qa', question: '请简述微服务架构相比单体架构的优缺点。', answer: '优点：独立部署、技术栈灵活、故障隔离；缺点：分布式复杂度高、运维成本、数据一致性难', score: 20, mastery: 3 },
      { id: 'q4', type: 'choice', question: 'Git 中用于合并多个提交的命令是？', options: ['git merge', 'git rebase', 'git reset', 'git cherry-pick'], answer: 'git rebase', score: 10, mastery: 3 },
    ],
  },
  {
    id: 'exam_sw_p4_draft',
    title: '软件工程师 P4 架构师认证考试（AI 组卷·待审核）',
    position: '软件工程师',
    grade: 'P4',
    passScore: 75,
    duration: 90,
    aiGenerated: true,
    status: 'pending_review',
    questions: [
      { id: 'q1', type: 'qa', question: '请设计一个支持百万级并发的秒杀系统架构。', answer: '分层+缓存+消息队列+限流降级+分布式锁', score: 30, mastery: 4 },
      { id: 'q2', type: 'qa', question: '如何保证分布式事务的最终一致性？', answer: 'TCC、Saga、本地消息表、可靠事件', score: 25, mastery: 4 },
    ],
  },
];

export interface ExamRecord {
  id: string;
  employeeId: string;
  paperId: string;
  score: number;
  passed: boolean;
  submittedAt: string;
  retryLeft: number;
}

export const examRecords: ExamRecord[] = [
  { id: 'er1', employeeId: 'E10086', paperId: 'exam_sw_p3', score: 62, passed: false, submittedAt: '2026-08-20', retryLeft: 1 },
];

// ============ IDP ============
export interface IDP {
  id: string;
  employeeId: string;
  period: string;
  /** 1 员工季度 2 管理者半年 */
  periodType: 1 | 2;
  goals: { ability: string; target: string }[];
  keyBehaviors: { behavior: string; plan: string; status: 'done' | 'doing' | 'todo' }[];
  reviewResult?: string;
  status: 'draft' | 'confirmed' | 'reviewing' | 'closed';
}

export const idpList: IDP[] = [
  {
    id: 'idp_lin_2026q3',
    employeeId: 'E10086',
    period: '2026 Q3',
    periodType: 1,
    status: 'confirmed',
    goals: [
      { ability: '分布式系统', target: '掌握分布式基础，P3→P4 知识达标' },
      { ability: '系统思维', target: '能独立完成模块级架构设计' },
    ],
    keyBehaviors: [
      { behavior: '完成《分布式系统基础》课程', plan: '8 月学完 12 学时课程', status: 'done' },
      { behavior: '主导 1 次模块设计评审', plan: '9 月承担登录模块重构设计', status: 'doing' },
      { behavior: '通过 P3 知识考试', plan: '10 月参加补考', status: 'todo' },
    ],
  },
  {
    id: 'idp_wang_2026h2',
    employeeId: 'E10020',
    period: '2026 H2',
    periodType: 2,
    status: 'confirmed',
    goals: [
      { ability: '团队管理', target: '提升团队交付效能，降低延期率' },
    ],
    keyBehaviors: [
      { behavior: '建立周度站会与风险同步机制', plan: '7 月起执行', status: 'done' },
      { behavior: '完成 2 名下属 IDP 复盘', plan: '12 月前', status: 'doing' },
    ],
  },
];

export const IDP_STATUS_LABEL = { draft: '草稿', confirmed: '已确认', reviewing: '复盘中', closed: '已归档' };

// ============ 辅导记录 ============
export interface CoachingRecord {
  id: string;
  employeeId: string;
  managerId: string;
  date: string;
  type: string;
  content: string;
  /** 效果回看 */
  effect?: string;
  /** 下期画像对比 */
  nextProfileCompare?: string;
}

export const coachingRecords: CoachingRecord[] = [
  {
    id: 'cr1', employeeId: 'E10086', managerId: 'E10020',
    date: '2026-07-10', type: '业绩辅导',
    content: '复盘 Q2 交付延期原因，明确 Q3 交付目标与里程碑；指导拆分任务、每日同步进度。',
    effect: 'Q3 交付 6 个模块 0 延期，业绩分由 78 提升至 82',
    nextProfileCompare: '业绩维度 78→82（+4），履职 62→70（+8）',
  },
  {
    id: 'cr2', employeeId: 'E10086', managerId: 'E10020',
    date: '2026-09-05', type: '知识辅导',
    content: '针对分布式知识短板，指定学习路径与考试计划；安排顾屿白（P4）作为技术导师。',
  },
  {
    id: 'cr3', employeeId: 'E10051', managerId: 'E10002',
    date: '2026-08-15', type: '履职辅导',
    content: '车间主任复评期，重点关注过程行为规范；要求每周提交生产异常根因分析。',
    effect: '9 月异常率环比下降 18%',
  },
];

/** 绩效导入批次 */
export interface PerfImportBatch {
  id: string;
  period: string;
  total: number;
  imported: number;
  status: 'pending' | 'importing' | 'done' | 'failed';
  errorCount: number;
  createdAt: string;
}

export const perfImportBatches: PerfImportBatch[] = [
  { id: 'perf_2026h1', period: '2026 H1', total: 650, imported: 650, status: 'done', errorCount: 0, createdAt: '2026-07-05' },
  { id: 'perf_2026q3', period: '2026 Q3', total: 650, imported: 420, status: 'importing', errorCount: 3, createdAt: '2026-10-10' },
];

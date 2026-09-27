/**
 * 认证主链 mock —— 剧本：许云清 SW-P3 → P4 认证（管委会路由）。
 * 状态机与路由规则对齐 PRD「认证与盘点状态机」：
 * P1→P2 部门经理单审 / P2→P3 认证小组表决 / P3→P4·P4→P5 管委会终审。
 */

export type CertStage =
  | 'basic_check'
  | 'exam'
  | 'evidence'
  | 'pre_review'
  | 'routed_review'
  | 'defense'
  | 'public_notice'
  | 'passed'
  | 'terminated'
  | 'withdrawn';

export const CERT_STAGE_LABEL: Record<CertStage, string> = {
  basic_check: '基本条件校验',
  exam: '知识测验',
  evidence: '履职举证',
  pre_review: '材料预审',
  routed_review: '路由评审',
  defense: '答辩表决',
  public_notice: '公示',
  passed: '已通过',
  terminated: '已终止',
  withdrawn: '已撤回',
};

/** 主链环节（用于步骤条；终态单独渲染） */
export const CERT_MAIN_CHAIN: CertStage[] = [
  'basic_check',
  'exam',
  'evidence',
  'pre_review',
  'routed_review',
  'defense',
  'public_notice',
];

export type CertRouter = 1 | 2 | 3;

export const CERT_ROUTER_LABEL: Record<CertRouter, string> = {
  1: '部门经理审批',
  2: '认证小组表决',
  3: '管委会终审',
};

export type EvidenceStatus = 'pending' | 'submitted' | 'rejected' | 'approved';

export interface EvidenceItem {
  name: string;
  task: string;
  status: EvidenceStatus;
  materials: string[];
  note?: string;
  aiTip?: string;
}

export interface VoteItem {
  member: string;
  memberTitle: string;
  choice: 'agree' | 'disagree' | null;
  comment?: string;
}

export interface TimelineItem {
  stage: CertStage;
  time: string;
  result: 'pass' | 'fail' | 'doing' | 'pending';
  note: string;
}

export interface CertRecord {
  id: string;
  employeeId: string;
  sequence: string;
  sequenceName: string;
  fromGrade: string;
  toGrade: string;
  certType: '晋升' | '复评' | '年度认证';
  router: CertRouter;
  stage: CertStage;
  /** 整体进度百分比 */
  progress: number;
  initiatedAt: string;
  deadline: string;
  examScore?: number;
  evidences: EvidenceItem[];
  votes?: VoteItem[];
  timeline: TimelineItem[];
  rejectHistory?: { time: string; by: string; reason: string }[];
  terminateReason?: string;
}

export const certifications: CertRecord[] = [
  {
    id: 'CERT-2026-0086',
    employeeId: 'E10086',
    sequence: 'SW',
    sequenceName: '软件研发序列',
    fromGrade: 'P3',
    toGrade: 'P4',
    certType: '晋升',
    router: 3,
    stage: 'evidence',
    progress: 45,
    initiatedAt: '2026-09-02',
    deadline: '2026-11-30',
    examScore: 86,
    evidences: [
      {
        name: '模块详细设计',
        task: '独立完成模块级详细设计与评审',
        status: 'submitted',
        materials: ['物流网关模块设计文档 v2.1.pdf', '评审会议纪要 0905.docx'],
        aiTip: 'AI 预审：文档含 2 处接口变更未标注影响范围，建议补充',
      },
      {
        name: '编码实现',
        task: '按规范完成核心模块编码',
        status: 'approved',
        materials: ['Q2/Q3 代码评审报告.pdf', 'CR 一次通过率统计.xlsx'],
        note: '一次通过率 87%（标准 ≥ 80%）',
        aiTip: 'AI 预审：达标，建议保留评审报告原始链接备查',
      },
      {
        name: '缺陷修复',
        task: '定位并修复线上复杂缺陷',
        status: 'rejected',
        materials: ['线上故障复盘报告 0812.pdf'],
        note: '驳回：缺根因分析章节，已补充后待复审',
        aiTip: 'AI 预审：补交版本已含 5-Why 根因分析，预计可通过',
      },
      {
        name: '技术改进',
        task: '参与组件/工具改进',
        status: 'pending',
        materials: [],
        aiTip: 'AI 提示：可引用「构建耗时优化 32%」专项，尚未归档材料',
      },
    ],
    timeline: [
      { stage: 'basic_check', time: '2026-09-03', result: 'pass', note: '本科 / 司龄 4 年 / 近一年绩效 B —— 全部达标' },
      { stage: 'exam', time: '2026-09-05', result: 'pass', note: '知识测验 86 分（合格线 80，AI 组卷）' },
      { stage: 'evidence', time: '—', result: 'doing', note: '4 项履职举证：1 通过 / 1 待复审 / 1 预审中 / 1 未开始' },
      { stage: 'pre_review', time: '—', result: 'pending', note: 'HR 材料预审' },
      { stage: 'routed_review', time: '—', result: 'pending', note: 'P3→P4：管委会评审' },
      { stage: 'defense', time: '—', result: 'pending', note: '述职答辩（最后一关）' },
      { stage: 'public_notice', time: '—', result: 'pending', note: '公示 5 个工作日' },
    ],
    rejectHistory: [
      { time: '2026-09-12', by: 'HR 材料预审（系统预检）', reason: '《线上故障复盘报告》缺根因分析章节，请补充 5-Why 分析后重新提交' },
    ],
  },
  {
    id: 'CERT-2026-0091',
    employeeId: 'E10091',
    sequence: 'SW',
    sequenceName: '软件研发序列',
    fromGrade: 'P2',
    toGrade: 'P3',
    certType: '晋升',
    router: 2,
    stage: 'defense',
    progress: 82,
    initiatedAt: '2026-08-15',
    deadline: '2026-10-31',
    examScore: 88,
    evidences: [
      { name: '模块开发', task: '在指导下完成功能模块开发', status: 'approved', materials: ['迭代交付清单.xlsx'] },
      { name: '缺陷修复', task: '修复一般缺陷并回归验证', status: 'approved', materials: ['缺陷闭环记录.xlsx'] },
      { name: '新人任务', task: '完成入职任务包', status: 'approved', materials: ['带教确认单.pdf'] },
    ],
    votes: [
      { member: '谢星野', memberTitle: '机械设计经理', choice: 'agree', comment: '举证扎实，答辩表达清晰' },
      { member: '韩朔', memberTitle: '工艺工程经理', choice: 'agree', comment: '同意通过' },
      { member: '江予安', memberTitle: '研发总监', choice: 'disagree', comment: '分布式知识测验虽过线但偏弱，建议补强后再议' },
      { member: '陆行舟', memberTitle: '软件研发经理', choice: null },
      { member: '冯柚', memberTitle: '质量经理', choice: null },
    ],
    timeline: [
      { stage: 'basic_check', time: '2026-08-16', result: 'pass', note: '基本条件达标' },
      { stage: 'exam', time: '2026-08-20', result: 'pass', note: '知识测验 88 分' },
      { stage: 'evidence', time: '2026-09-01', result: 'pass', note: '3 项举证全部通过预审' },
      { stage: 'pre_review', time: '2026-09-08', result: 'pass', note: 'HR 预审通过' },
      { stage: 'routed_review', time: '2026-09-15', result: 'doing', note: '认证小组表决中（3/5 已表决）' },
      { stage: 'public_notice', time: '—', result: 'pending', note: '表决通过后公示' },
    ],
  },
  {
    id: 'CERT-2026-0089',
    employeeId: 'E10089',
    sequence: 'SW',
    sequenceName: '软件研发序列',
    fromGrade: 'P2',
    toGrade: 'P3',
    certType: '晋升',
    router: 2,
    stage: 'pre_review',
    progress: 55,
    initiatedAt: '2026-08-20',
    deadline: '2026-11-15',
    examScore: 74,
    evidences: [
      { name: '模块开发', task: '在指导下完成功能模块开发', status: 'submitted', materials: ['CR 管理后台开发总结.pdf'] },
      { name: '缺陷修复', task: '修复一般缺陷并回归验证', status: 'submitted', materials: ['缺陷闭环记录 0830.xlsx'] },
      { name: '新人任务', task: '完成入职任务包', status: 'approved', materials: ['带教确认单.pdf'] },
    ],
    timeline: [
      { stage: 'basic_check', time: '2026-08-21', result: 'pass', note: '基本条件达标' },
      { stage: 'exam', time: '2026-08-28', result: 'fail', note: '首考 68 分未达线 → 补考' },
      { stage: 'exam', time: '2026-09-06', result: 'pass', note: '补考 74 分（合格线 70）' },
      { stage: 'evidence', time: '2026-09-18', result: 'doing', note: '举证已提交，待部门经理预审' },
      { stage: 'pre_review', time: '—', result: 'doing', note: '陆行舟（部门经理）预审中' },
      { stage: 'routed_review', time: '—', result: 'pending', note: '认证小组表决' },
    ],
  },
  {
    id: 'CERT-2026-0104',
    employeeId: 'E10104',
    sequence: 'ENG',
    sequenceName: '机械工程序列',
    fromGrade: 'P3',
    toGrade: 'P4',
    certType: '晋升',
    router: 3,
    stage: 'defense',
    progress: 86,
    initiatedAt: '2026-07-10',
    deadline: '2026-10-20',
    examScore: 91,
    evidences: [
      { name: '整机结构设计', task: '主导子系统结构设计', status: 'approved', materials: ['XX 产线结构设计包.pdf'] },
      { name: '工艺落地', task: '设计向工艺转化跟进', status: 'approved', materials: ['试产问题清单闭环.xlsx'] },
      { name: '降本改进', task: '结构降本专项', status: 'approved', materials: ['降本 6.8% 结案报告.pdf'] },
    ],
    votes: [
      { member: '沈既明', memberTitle: '首席执行官', choice: 'agree', comment: '成果可量化，同意' },
      { member: '温晚晴', memberTitle: 'HRD / 管委会', choice: null },
      { member: '岑屿', memberTitle: '制造总监', choice: 'agree', comment: '试产闭环质量高' },
      { member: '简时', memberTitle: '财务总监', choice: 'agree', comment: '降本数据经财务复核' },
      { member: '温既白', memberTitle: '营销总监', choice: 'agree' },
    ],
    timeline: [
      { stage: 'basic_check', time: '2026-07-11', result: 'pass', note: '近两年含 A，达标' },
      { stage: 'exam', time: '2026-07-18', result: 'pass', note: '知识测验 91 分' },
      { stage: 'evidence', time: '2026-08-05', result: 'pass', note: '3 项举证全部通过' },
      { stage: 'pre_review', time: '2026-08-12', result: 'pass', note: 'HR 预审通过' },
      { stage: 'defense', time: '2026-09-25', result: 'doing', note: '管委会表决中（4/5 已表决，待温晚晴）' },
      { stage: 'public_notice', time: '—', result: 'pending', note: '表决通过后公示' },
    ],
  },
  {
    id: 'CERT-2026-0093',
    employeeId: 'E10093',
    sequence: 'SW',
    sequenceName: '软件研发序列',
    fromGrade: 'P2',
    toGrade: 'P3',
    certType: '晋升',
    router: 2,
    stage: 'terminated',
    progress: 100,
    initiatedAt: '2026-08-01',
    deadline: '2026-10-31',
    terminateReason: '硬校验不通过：近一年绩效 C 级，未达「B 级以上」业绩门槛。下一认证周期可重新发起。',
    evidences: [],
    timeline: [
      { stage: 'basic_check', time: '2026-08-02', result: 'fail', note: '业绩条件未达：2025 年度绩效 C' },
      { stage: 'terminated', time: '2026-08-02', result: 'fail', note: '规则引擎硬性终止，未产生评审成本' },
    ],
  },
];

/** 许云清历史认证记录（供「我的认证」页） */
export const certHistory: {
  employeeId: string;
  id: string;
  toGrade: string;
  passedAt: string;
  certType: string;
  note: string;
}[] = [
  { employeeId: 'E10086', id: 'CERT-2024-1186', toGrade: 'P3', passedAt: '2024-11-20', certType: '晋升', note: '答辩表决 5/5 通过' },
  { employeeId: 'E10086', id: 'CERT-2023-0086', toGrade: 'P2', passedAt: '2023-06-15', certType: '晋升', note: '部门经理审批通过' },
];

export function certByEmployee(employeeId: string): CertRecord[] {
  return certifications.filter((c) => c.employeeId === employeeId);
}

export function certById(id: string): CertRecord | undefined {
  return certifications.find((c) => c.id === id);
}

/** 指定职级跳跃对应的路由（对齐 PRD） */
export function routerOf(fromGrade: string): CertRouter {
  const n = Number(fromGrade.replace(/\D/g, ''));
  if (n <= 1) return 1;
  if (n === 2) return 2;
  return 3;
}

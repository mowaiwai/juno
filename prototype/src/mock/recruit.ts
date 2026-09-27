/**
 * 批次 8 · 招聘面试 mock
 * 规则来源 PRD 模块三：履职表即题库；任职资格四部分（履职/知识/能力/业绩）均可转面试题；
 * AI 按职级/掌握层级自动出题（待审核）；面试记录与候选人画像比对。
 */

// ============ 在招需求 ============
export interface Requisition {
  id: string;
  position: string;
  dept: string;
  grade: string;
  headcount: number;
  /** 漏斗：简历 → 初筛 → 初试 → 复试 → offer */
  funnel: number[];
  owner: string;
  priority: 'high' | 'mid';
  openedAt: string;
}

export const requisitions: Requisition[] = [
  { id: 'REQ01', position: '高级软件工程师', dept: '软件研发部', grade: 'P4', headcount: 2, funnel: [46, 18, 7, 3, 1], owner: '王建国', priority: 'high', openedAt: '2026-08-20' },
  { id: 'REQ02', position: '机械工程师', dept: '机械设计部', grade: 'P3', headcount: 3, funnel: [38, 15, 8, 4, 2], owner: '赵磊', priority: 'high', openedAt: '2026-08-25' },
  { id: 'REQ03', position: '大客户经理', dept: '销售部', grade: 'S3', headcount: 1, funnel: [29, 10, 4, 2, 0], owner: '韩雪', priority: 'mid', openedAt: '2026-09-01' },
  { id: 'REQ04', position: '质量工程师', dept: '质量部', grade: 'T3', headcount: 1, funnel: [24, 9, 3, 1, 1], owner: '林晓', priority: 'mid', openedAt: '2026-09-05' },
];

// ============ 候选人管道 ============
export type CandStage = 'screen' | 'first' | 'final' | 'offer' | 'onboard' | 'rejected';

export const CAND_STAGE_LABEL: Record<CandStage, string> = {
  screen: '简历初筛',
  first: '初试',
  final: '复试',
  offer: 'Offer',
  onboard: '已入职',
  rejected: '已淘汰',
};

export interface Candidate {
  id: string;
  name: string;
  reqId: string;
  stage: CandStage;
  source: string;
  /** 与目标岗位画像匹配度 */
  matchScore: number;
  years: number;
  lastTitle: string;
  expectedSalary: number;
  rating?: number;
  tags: string[];
  appliedAt: string;
}

export const candidates: Candidate[] = [
  { id: 'C001', name: '顾远航', reqId: 'REQ01', stage: 'offer', source: 'BOSS 直聘', matchScore: 88, years: 7, lastTitle: '高级后端工程师', expectedSalary: 38000, rating: 4.5, tags: ['分布式', '带过小团队'], appliedAt: '2026-08-28' },
  { id: 'C002', name: '卢志强', reqId: 'REQ01', stage: 'final', source: '内推', matchScore: 79, years: 6, lastTitle: '软件工程师', expectedSalary: 35000, rating: 4, tags: ['Java 扎实'], appliedAt: '2026-09-02' },
  { id: 'C003', name: '毛晓峰', reqId: 'REQ01', stage: 'first', source: '猎头', matchScore: 72, years: 5, lastTitle: '全栈工程师', expectedSalary: 32000, tags: ['前后端通'], appliedAt: '2026-09-10' },
  { id: 'C004', name: '邱实', reqId: 'REQ01', stage: 'screen', source: 'BOSS 直聘', matchScore: 64, years: 4, lastTitle: '后端工程师', expectedSalary: 28000, tags: ['简历待筛'], appliedAt: '2026-09-18' },
  { id: 'C005', name: '苏文博', reqId: 'REQ02', stage: 'onboard', source: '校招', matchScore: 82, years: 0, lastTitle: '机械工程硕士', expectedSalary: 22000, rating: 4.2, tags: ['仿真竞赛', '校招优秀'], appliedAt: '2026-08-30' },
  { id: 'C006', name: '魏然', reqId: 'REQ02', stage: 'final', source: '内推', matchScore: 85, years: 5, lastTitle: '机械设计工程师', expectedSalary: 27000, rating: 4.3, tags: ['结构件经验'], appliedAt: '2026-09-05' },
  { id: 'C007', name: '阮明', reqId: 'REQ02', stage: 'first', source: '智联', matchScore: 68, years: 3, lastTitle: '机械工程师', expectedSalary: 22000, tags: ['基础一般'], appliedAt: '2026-09-12' },
  { id: 'C008', name: '任远', reqId: 'REQ03', stage: 'final', source: '猎头', matchScore: 86, years: 8, lastTitle: '行业销售经理', expectedSalary: 38000, rating: 4.4, tags: ['客户资源', '大客户打法'], appliedAt: '2026-09-06' },
  { id: 'C009', name: '唐鑫', reqId: 'REQ03', stage: 'first', source: 'BOSS 直聘', matchScore: 70, years: 5, lastTitle: '客户经理', expectedSalary: 30000, tags: ['冲劲足'], appliedAt: '2026-09-14' },
  { id: 'C010', name: '尹航', reqId: 'REQ04', stage: 'offer', source: '内推', matchScore: 90, years: 6, lastTitle: '质量工程师', expectedSalary: 24000, rating: 4.6, tags: ['六西格玛黑带', '体系审核'], appliedAt: '2026-09-08' },
  { id: 'C011', name: '龚磊', reqId: 'REQ01', stage: 'rejected', source: '智联', matchScore: 55, years: 4, lastTitle: '初级工程师', expectedSalary: 26000, rating: 2.5, tags: ['深度不足'], appliedAt: '2026-09-01' },
];

// ============ AI 生成 JD ============
export const aiJd = {
  position: '高级软件工程师（P4）',
  generatedAt: '2026-08-18',
  sections: [
    { h: '岗位职责', items: ['独立完成核心模块的详细设计与评审，设计文档一次评审通过', '按规范完成核心模块编码，代码评审一次通过率 ≥ 80%', 'SLA 内闭环复杂线上缺陷并输出根因分析', '担任新人带教导师，至少 1 人次'] },
    { h: '任职要求', items: ['本科及以上，5 年以上软件研发经验，司龄不限（外部岗位）', '精通至少一门后端语言与常用中间件', '近一年绩效 B 级以上（外部以业绩证明材料替代）', '掌握分布式系统基础（P4 知识要求 2 级以上）'] },
  ],
  basis: '依据 SW-P4 任职资格标准（v2.3）履职表与知识技能项自动生成，引用可追溯。',
};

// ============ 面试题库（履职表即题库） ============
export type QDimension = 1 | 2 | 3 | 4;
export const DIM_LABEL: Record<QDimension, string> = { 1: '履职', 2: '知识', 3: '能力', 4: '业绩' };

export interface InterviewQuestion {
  id: string;
  dimension: QDimension;
  position: string;
  grade: string;
  question: string;
  answerPoint?: string;
  /** 0 人工 / 履职表转制 1 AI 生成（待审核） */
  source: 'manual' | 'standard' | 'ai';
  status: 'approved' | 'pending_review' | 'rejected';
}

export const interviewQuestions: InterviewQuestion[] = [
  { id: 'IQ01', dimension: 1, position: '高级软件工程师', grade: 'P4', question: '请讲一次你独立完成模块详细设计的经历：设计中最难的取舍是什么？评审收到了哪些意见？', answerPoint: '取舍有依据、评审意见被采纳、无重大返工', source: 'standard', status: 'approved' },
  { id: 'IQ02', dimension: 1, position: '高级软件工程师', grade: 'P4', question: '讲一个你定位并修复的最复杂线上缺陷：排查路径、根因和后续预防动作？', answerPoint: 'SLA 内闭环、有根因分析、预防机制落地', source: 'standard', status: 'approved' },
  { id: 'IQ03', dimension: 2, position: '高级软件工程师', grade: 'P4', question: 'CAP 理论在你们系统里是怎么落地的？举一个为可用性牺牲一致性的真实决策。', answerPoint: '概念准确、决策与业务约束挂钩', source: 'ai', status: 'pending_review' },
  { id: 'IQ04', dimension: 2, position: '机械工程师', grade: 'P3', question: '公差累积在你最近的设计里怎么控制？仿真和实测偏差多少，如何收敛？', answerPoint: '公差链方法清晰、有实测数据', source: 'ai', status: 'approved' },
  { id: 'IQ05', dimension: 3, position: '高级软件工程师', grade: 'P4', question: '跨团队推进一个有分歧的方案时，你怎么让信息同步、承诺兑现？', answerPoint: '协同推进 2 级关键行为：信息同步及时、承诺可兑现', source: 'standard', status: 'approved' },
  { id: 'IQ06', dimension: 3, position: '大客户经理', grade: 'S3', question: '客户提出超出合同的要求且态度强硬，你最近一次是怎么处理的？', answerPoint: '客户导向 2 级：澄清需求背后的真实问题，而非简单让步', source: 'ai', status: 'pending_review' },
  { id: 'IQ07', dimension: 4, position: '高级软件工程师', grade: 'P4', question: '最近 6–12 个月你优化了哪个点？产出什么效果，用数据说明。', answerPoint: '追问话术：优化点具体、效果可量化、个人贡献边界清楚', source: 'manual', status: 'approved' },
  { id: 'IQ08', dimension: 4, position: '大客户经理', grade: 'S3', question: '讲一个你签下的最难的单子：周期、关键转折和你个人起到的作用？', answerPoint: '业绩真实可核、打法可复用', source: 'standard', status: 'approved' },
  { id: 'IQ09', dimension: 1, position: '质量工程师', grade: 'T3', question: '体系审核中发现过的最严重不符合项是什么？纠正措施怎么验证有效性？', answerPoint: '措施闭环、有验证记录', source: 'ai', status: 'rejected' },
];

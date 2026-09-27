/**
 * 批次 6 mock —— 继任者计划与人才梯队。
 * 规则对齐 PRD：先找核心岗位再盘知识能力；72 小时补位；关键岗位 7-15 条能力模型、半年盘点、知识考试+意愿确认。
 */
import { employees } from '@/mock/people';
import { positions, deptName } from '@/mock/org';
import { latestProfile } from '@/mock/profiles';
import type { Employee } from '@/types';

// ============ 核心岗位清单 ============
export interface CorePosition {
  id: string;
  name: string;
  deptName: string;
  grade: string;
  headcount: number;
  incumbentId?: string;
  incumbentName?: string;
  /** 候选人数 */
  candidateCount: number;
  /** 继任覆盖率 */
  coverage: number;
  /** 风险等级 */
  risk: 'HIGH' | 'MID' | 'LOW';
  riskReason: string;
}

export function corePositions(): CorePosition[] {
  return positions
    .filter((p) => p.isCore)
    .map((p) => {
      const incumbent = employees.find((e) => e.position === p.name);
      const candidates = successionCandidates(p.id);
      const coverage = candidates.length / Math.max(1, p.headcount);
      let risk: CorePosition['risk'] = 'LOW';
      let riskReason = '继任梯队充足';
      if (!incumbent) {
        risk = 'HIGH';
        riskReason = '岗位空缺，需立即补位';
      } else if (candidates.length === 0) {
        risk = 'HIGH';
        riskReason = '无继任候选人，存在断档风险';
      } else if (coverage < 1) {
        risk = 'MID';
        riskReason = '继任候选不足，覆盖率低于 100%';
      } else if (incumbent.risk === 'HIGH') {
        risk = 'MID';
        riskReason = '在岗人存在流失风险';
      }
      return {
        id: p.id,
        name: p.name,
        deptName: deptName(p.deptId),
        grade: p.grade,
        headcount: p.headcount,
        incumbentId: incumbent?.id,
        incumbentName: incumbent?.name,
        candidateCount: candidates.length,
        coverage: Math.min(1, coverage),
        risk,
        riskReason,
      };
    });
}

// ============ 继任矩阵 ============
export type Willingness = 'unconfirmed' | 'willing' | 'unwilling';
export type Readiness = 'ready' | '6m' | '1y' | '2y';

export interface SuccessionCandidate {
  employeeId: string;
  name: string;
  position: string;
  matchScore: number;
  willingness: Willingness;
  readiness: Readiness;
  /** 匹配维度摘要 */
  matchSummary: string;
}

const WILLINGNESS_LABEL: Record<Willingness, string> = {
  unconfirmed: '未确认', willing: '愿意', unwilling: '不愿意',
};
const READINESS_LABEL: Record<Readiness, string> = {
  ready: '立即可继任', '6m': '6 个月内', '1y': '1 年内', '2y': '2 年内',
};

/** 为某核心岗位生成继任候选人（mock：用画像能力分+绩效推导匹配度） */
export function successionCandidates(positionId: string): SuccessionCandidate[] {
  const pos = positions.find((p) => p.id === positionId);
  if (!pos) return [];
  // 候选：同序列或同部门，绩效 B 以上，排除在岗人
  const incumbent = employees.find((e) => e.position === pos.name);
  const pool = employees.filter(
    (e) => e.id !== incumbent?.id && e.perfScore >= 75 && e.sequence === pos.sequence,
  );
  if (pool.length === 0) {
    // 降级：同部门
    return employees
      .filter((e) => e.id !== incumbent?.id && e.deptId === pos.deptId && e.perfScore >= 75)
      .slice(0, 3)
      .map((e) => buildCandidate(e, pos));
  }
  return pool.slice(0, 4).map((e) => buildCandidate(e, pos));
}

function buildCandidate(e: Employee, pos: { grade: string }): SuccessionCandidate {
  const profile = latestProfile(e.id);
  const ability = (profile.dims.ability.score + profile.dims.duty.score) / 2;
  const gradeDiff = parseInt(e.grade.replace(/\D/g, '')) - parseInt(pos.grade.replace(/\D/g, ''));
  const matchScore = Math.round(
    Math.min(100, ability * 0.4 + e.perfScore * 0.3 + (e.potential === 'HIGH' ? 90 : e.potential === 'MID' ? 70 : 50) * 0.3 - gradeDiff * 5),
  );
  const readiness: Readiness = matchScore >= 85 ? 'ready' : matchScore >= 75 ? '6m' : matchScore >= 65 ? '1y' : '2y';
  const willingness: Willingness =
    e.risk === 'HIGH' ? 'unwilling' : e.potential === 'HIGH' ? 'willing' : 'unconfirmed';
  return {
    employeeId: e.id,
    name: e.name,
    position: e.position,
    matchScore,
    willingness,
    readiness,
    matchSummary: `能力 ${Math.round(ability)} · 绩效 ${e.perfScore} · 潜力 ${e.potential}`,
  };
}

export { WILLINGNESS_LABEL, READINESS_LABEL };

// ============ 离职风险预警 ============
export interface RiskWarning {
  employeeId: string;
  name: string;
  position: string;
  deptName: string;
  level: 'HIGH' | 'MID' | 'LOW';
  /** 风险评分 0-100 */
  score: number;
  /** 原因引用 */
  reasons: string[];
  /** 干预建议 */
  suggestion: string;
}

/** 离职风险评分：绩效下滑、司龄过长、潜力低、流失风险标签 */
export function riskWarnings(): RiskWarning[] {
  return employees
    .map((e) => {
      const reasons: string[] = [];
      let score = 0;
      if (e.risk === 'HIGH') { score += 40; reasons.push('历史流失风险标记为高'); }
      if (e.perfScore < 75) { score += 20; reasons.push(`近一期绩效 ${e.perf}（${e.perfScore}），低于 B 级`); }
      if (e.potential === 'LOW') { score += 15; reasons.push('潜力评估为低，职业发展空间受限'); }
      if (e.years >= 10) { score += 15; reasons.push(`司龄 ${e.years} 年，长期未轮岗易倦怠`); }
      const profile = latestProfile(e.id);
      if (profile.dims.ability.score >= 75 && e.perfScore < 78) {
        score += 20; reasons.push('能力强但业绩差，提示意愿度问题');
      }
      if (score === 0) return null;
      const level: RiskWarning['level'] = score >= 60 ? 'HIGH' : score >= 35 ? 'MID' : 'LOW';
      return {
        employeeId: e.id,
        name: e.name,
        position: e.position,
        deptName: deptName(e.deptId),
        level,
        score: Math.min(100, score),
        reasons,
        suggestion:
          level === 'HIGH'
            ? 'HRBP 72 小时内介入面谈，了解真实原因，启动保留方案'
            : level === 'MID'
            ? '主管月度 1:1 关注，结合 IDP 调整工作内容与激励'
            : '持续观察，季度盘点时复核',
      } as RiskWarning;
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as RiskWarning[];
}

// ============ 意愿确认 ============
export interface WillingnessRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  position: string;
  targetPosition: string;
  willingness: Willingness;
  confirmedAt?: string;
  note?: string;
}

export const willingnessRecords: WillingnessRecord[] = [
  { id: 'w1', employeeId: 'E10002', employeeName: '温晚晴', position: 'HRD', targetPosition: '首席执行官', willingness: 'willing', confirmedAt: '2026-09-12', note: '愿意承担更大管理责任' },
  { id: 'w2', employeeId: 'E10087', employeeName: '顾屿白', position: '高级软件工程师', targetPosition: '软件研发经理', willingness: 'unconfirmed' },
  { id: 'w3', employeeId: 'E10020', employeeName: '陆行舟', position: '软件研发经理', targetPosition: '研发总监', willingness: 'willing', confirmedAt: '2026-09-10' },
  { id: 'w4', employeeId: 'E10104', employeeName: '汪漾', position: '高级机械工程师', targetPosition: '机械设计经理', willingness: 'unwilling', confirmedAt: '2026-09-08', note: '希望继续走专家路线' },
  { id: 'w5', employeeId: 'E10051', employeeName: '唐雨时', position: '车间主任', targetPosition: '制造总监', willingness: 'unconfirmed' },
];

// ============ 梯队池 ============
export type PoolLevel = 'L1' | 'L2' | 'L3';
export const POOL_LEVEL_LABEL: Record<PoolLevel, string> = {
  L1: '一级梯队（核心继任）',
  L2: '二级梯队（重点培养）',
  L3: '三级梯队（潜力储备）',
};

export interface PoolMember {
  employeeId: string;
  name: string;
  position: string;
  level: PoolLevel;
  /** 入池依据 */
  reason: string;
  /** 入池时间 */
  joinedAt: string;
  status: 'active' | 'graduated' | 'exited';
}

export const poolMembers: PoolMember[] = [
  { employeeId: 'E10002', name: '温晚晴', position: 'HRD', level: 'L1', reason: '高潜+高管级绩效，管委会认可', joinedAt: '2025-01-10', status: 'active' },
  { employeeId: 'E10020', name: '陆行舟', position: '软件研发经理', level: 'L1', reason: '研发中坚，管理潜力突出', joinedAt: '2025-03-15', status: 'active' },
  { employeeId: 'E10087', name: '顾屿白', position: '高级软件工程师', level: 'L1', reason: 'P4 核心，技术深度+领导力', joinedAt: '2025-06-01', status: 'active' },
  { employeeId: 'E10086', name: '许星遥', position: '软件工程师', level: 'L2', reason: '高潜，P3→P4 成长中', joinedAt: '2026-01-10', status: 'active' },
  { employeeId: 'E10093', name: '温以宁', position: '软件工程师', level: 'L2', reason: '绩效 A，系统思维强', joinedAt: '2026-02-20', status: 'active' },
  { employeeId: 'E10161', name: '秦越', position: '大客户经理', level: 'L2', reason: '销冠，客户资源丰富', joinedAt: '2026-03-01', status: 'active' },
  { employeeId: 'E10092', name: '许言蹊', position: '软件工程师', level: 'L3', reason: '潜力中，绩效稳定', joinedAt: '2026-05-10', status: 'active' },
  { employeeId: 'E10062', name: '孙娜', position: '质量工程师', level: 'L3', reason: '严谨细致，质量意识强', joinedAt: '2026-06-15', status: 'active' },
];

// ============ AB 角 ============
export interface ABrole {
  id: string;
  positionId: string;
  positionName: string;
  deptName: string;
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  /** B 角培养状态 */
  bStatus: 'training' | 'ready' | 'shadowing';
}

export const abRoles: ABrole[] = [
  { id: 'ab1', positionId: 'p003', positionName: '软件研发经理', deptName: '软件研发部', aId: 'E10020', aName: '陆行舟', bId: 'E10087', bName: '顾屿白', bStatus: 'shadowing' },
  { id: 'ab2', positionId: 'p007', positionName: '机械设计经理', deptName: '机械设计部', aId: 'E10030', aName: '谢星野', bId: 'E10104', bName: '汪漾', bStatus: 'training' },
  { id: 'ab3', positionId: 'p013', positionName: '车间主任', deptName: '机加车间', aId: 'E10051', aName: '唐雨时', bId: 'E10052', bName: '何栖迟', bStatus: 'training' },
  { id: 'ab4', positionId: 'p018', positionName: '大客户经理', deptName: '销售部', aId: 'E10161', aName: '秦越', bId: 'E10162', bName: '白溪', bStatus: 'ready' },
];

export const AB_STATUS_LABEL = { training: '培养中', ready: '已就绪', shadowing: '跟岗中' };

// ============ 培养跟踪 ============
export interface PoolTraining {
  id: string;
  employeeId: string;
  employeeName: string;
  level: PoolLevel;
  /** 培养项目 */
  program: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: 'doing' | 'done' | 'pending';
  /** 带教人 */
  mentor: string;
}

export const poolTrainings: PoolTraining[] = [
  { id: 'pt1', employeeId: 'E10086', employeeName: '许星遥', level: 'L2', program: 'P4 晋升加速营', startDate: '2026-07-01', endDate: '2026-12-31', progress: 60, status: 'doing', mentor: '顾屿白' },
  { id: 'pt2', employeeId: 'E10093', employeeName: '温以宁', level: 'L2', program: '系统思维训练营', startDate: '2026-08-01', endDate: '2026-11-30', progress: 40, status: 'doing', mentor: '陆行舟' },
  { id: 'pt3', employeeId: 'E10087', employeeName: '顾屿白', level: 'L1', program: '管理者转身项目', startDate: '2026-06-01', endDate: '2026-12-31', progress: 75, status: 'doing', mentor: '江予安' },
  { id: 'pt4', employeeId: 'E10161', employeeName: '秦越', level: 'L2', program: '销售管理者培养', startDate: '2026-05-01', endDate: '2026-10-31', progress: 100, status: 'done', mentor: '温既白' },
];

export const TRAINING_STATUS_LABEL = { doing: '进行中', done: '已完成', pending: '待启动' };

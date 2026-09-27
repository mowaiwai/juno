/**
 * 七维人才画像 mock —— 维度对齐 PRD profile_snapshot 表：
 * 基本条件 / 业绩 / 团队贡献 / 职责履行 / 知识技能 / 能力素质 / 绩效。
 * 画像版本化，按周期生成；认证通过后回写。
 */

export interface ProfileDimension {
  key: string;
  name: string;
}

export const PROFILE_DIMENSIONS: ProfileDimension[] = [
  { key: 'basic', name: '基本条件' },
  { key: 'biz', name: '业绩' },
  { key: 'contribution', name: '团队贡献' },
  { key: 'duty', name: '职责履行' },
  { key: 'knowledge', name: '知识技能' },
  { key: 'ability', name: '能力素质' },
  { key: 'perf', name: '绩效' },
];

export const DIMENSION_NAME: Record<string, string> = Object.fromEntries(
  PROFILE_DIMENSIONS.map((d) => [d.key, d.name]),
);

export interface DimScore {
  score: number;
  /** 优 / 良 / 达标 / 待改进 */
  grade: string;
  note: string;
}

export interface ProfileSnapshot {
  employeeId: string;
  version: string;
  generatedAt: string;
  source: string;
  overall: number;
  dims: Record<string, DimScore>;
  summary: string;
}

function d(score: number, note: string): DimScore {
  return {
    score,
    grade: score >= 85 ? '优' : score >= 75 ? '良' : score >= 60 ? '达标' : '待改进',
    note,
  };
}

/** 主剧本：许云清（三个版本，供画像对比） */
const LIN_VERSIONS: ProfileSnapshot[] = [
  {
    employeeId: 'E10086',
    version: 'v2024 年度',
    generatedAt: '2025-01-10',
    source: '年度生成',
    overall: 66,
    dims: {
      basic: d(72, '本科 / 司龄 2 年，条件刚达标'),
      biz: d(64, '年度交付 5 个迭代模块，2 次延期'),
      contribution: d(55, '尚未承担带教与分享'),
      duty: d(62, 'P2 履职达标，复杂模块需指导'),
      knowledge: d(58, '算法扎实，分布式与工具链偏弱'),
      ability: d(68, '协同推进好，系统思维待建立'),
      perf: d(78, '年度 B+'),
    },
    summary:
      '许云清处于 P2→P3 成长期：执行可靠、协同口碑好，短板集中在分布式知识与跨模块系统思维。建议以「补知识 + 带教参与」作为下年度主线。',
  },
  {
    employeeId: 'E10086',
    version: 'v2025Q2',
    generatedAt: '2025-07-08',
    source: '季度更新',
    overall: 71,
    dims: {
      basic: d(76, '司龄 3 年，条件稳步积累'),
      biz: d(70, '上半年交付 6 个模块，0 延期'),
      contribution: d(62, '首次参与 2 次内部技术分享'),
      duty: d(70, 'P3 履职基本达标，独立设计 2 个模块'),
      knowledge: d(66, '分布式基础补齐，工具链达标'),
      ability: d(72, '需求澄清能力明显进步'),
      perf: d(80, '半年度 B+'),
    },
    summary:
      '晋升 P3 后履责面扩大：交付质量稳定，知识短板经 IDP 补齐一半。团队贡献开始破零，下阶段建议承担 1 名新人带教。',
  },
  {
    employeeId: 'E10086',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '认证回写',
    overall: 74,
    dims: {
      basic: d(78, '司龄 4 年，满足 P4 基本条件'),
      biz: d(74, 'Q2-Q3 关键模块 0 重大返工'),
      contribution: d(68, '担任新人带教导师 1 人次（进行中）'),
      duty: d(76, 'P4 四项履职举证 2 项已过预审'),
      knowledge: d(70, '知识测验 86 分，仍缺分布式进阶'),
      ability: d(74, '系统思维有案例支撑，答辩待验证'),
      perf: d(84, '2025 年度 B（84 分）'),
    },
    summary:
      '当前处于 P4 认证窗口：职责履行与团队贡献两维因认证举证显著上行，绩效维稳定。若 Q4 保持交付节奏，整体分有望突破 78。',
  },
];

/** 其余重点人员快照（单版本） */
const SNAPSHOTS: ProfileSnapshot[] = [
  {
    employeeId: 'E10092',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '年度生成',
    overall: 88,
    dims: {
      basic: d(82, '司龄 5 年'),
      biz: d(92, '核心链路重构主导者'),
      contribution: d(84, '带教 2 人，3 次分享'),
      duty: d(90, 'P4 履职全维达标'),
      knowledge: d(86, '架构与算法双优'),
      ability: d(88, '技术判断力突出'),
      perf: d(96, '年度 S（96 分）'),
    },
    summary:
      '温以宁为软件研发部综合分第一：业绩、履职、绩效三优。明星员工，建议纳入 P5 储备与核心保留名单，注意 MID 流动性信号。',
  },
  {
    employeeId: 'E10093',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '年度生成',
    overall: 58,
    dims: {
      basic: d(70, '司龄 6 年'),
      biz: d(52, '连续两季度交付不达预期'),
      contribution: d(45, '无带教与分享记录'),
      duty: d(55, 'P3 履职两项未达标'),
      knowledge: d(58, '知识面停滞'),
      ability: d(60, '主动性不足信号'),
      perf: d(74, '年度 C（74 分）'),
    },
    summary:
      '董斯年画像连续两个周期下滑：业绩与履职双弱，认证硬校验已被终止。建议进入绩效改进流程（PIP），管理者两周内完成改进面谈。',
  },
  {
    employeeId: 'E10087',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '年度生成',
    overall: 85,
    dims: {
      basic: d(84, '司龄 7 年'),
      biz: d(88, '网关性能专项主要负责人'),
      contribution: d(82, 'B 角培养中，2 次跨部门分享'),
      duty: d(86, 'P4 履职达标'),
      knowledge: d(85, '分布式与中间件深厚'),
      ability: d(84, '系统思维强'),
      perf: d(92, '年度 A（92 分）'),
    },
    summary:
      '顾屿白技术纵深与协同均衡，是 P5 的自然候选。建议给跨团队架构主导权，验证技术影响力维度。',
  },
  {
    employeeId: 'E10089',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '季度更新',
    overall: 63,
    dims: {
      basic: d(72, '司龄 2 年'),
      biz: d(62, '交付平稳但复杂度低'),
      contribution: d(58, '参与 1 次分享'),
      duty: d(60, 'P3 履职部分达标'),
      knowledge: d(52, '首考未过线，补考通过'),
      ability: d(66, '学习意愿强'),
      perf: d(75, '年度 C（75 分）'),
    },
    summary:
      '曹沐辰知识维是当前唯一明显短板（补考通过），其余维度在增长通道。建议 IDP 聚焦知识提升计划，暂缓认证冲刺。',
  },
  {
    employeeId: 'E10091',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '认证回写',
    overall: 76,
    dims: {
      basic: d(74, '司龄 1 年，破格通道'),
      biz: d(78, '两个模块独立交付'),
      contribution: d(70, '新人任务包标兵'),
      duty: d(74, 'P3 举证全部过审'),
      knowledge: d(72, '测验 88 分'),
      ability: d(76, '答辩表现好'),
      perf: d(83, '年度 B（83 分）'),
    },
    summary:
      '许清禾成长斜率全组最高：1 年内完成 P2→P3 认证链路。高潜，建议管理者纳入梯队观察名单。',
  },
  {
    employeeId: 'E10094',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '年度生成',
    overall: 79,
    dims: {
      basic: d(70, '司龄 2 年'),
      biz: d(82, '季度交付质量最优新人'),
      contribution: d(72, '工具改进 2 项被采纳'),
      duty: d(78, 'P2 履职全达标'),
      knowledge: d(76, '测验 90 分'),
      ability: d(78, '主动性突出'),
      perf: d(88, '年度 A（88 分）'),
    },
    summary:
      '许言蹊绩效与知识双优，梯队候选标签成立。下一窗口可发起 P2→P3 认证，建议经理提前布置举证材料。',
  },
  {
    employeeId: 'E10020',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '年度生成',
    overall: 84,
    dims: {
      basic: d(88, '司龄 9 年，管理岗认证通过'),
      biz: d(84, '团队年度目标达成 108%'),
      contribution: d(86, '认证小组成员，带教 4 人'),
      duty: d(82, 'M2 管理履职达标'),
      knowledge: d(78, '技术管理双线'),
      ability: d(82, '团队建设能力突出'),
      perf: d(90, '年度 A（90 分）'),
    },
    summary:
      '陆行舟管理维全面达标，团队人效与认证通过率双高。风险点：团队呈哑铃型，中坚层厚度不足，需持续补 P3/P4。',
  },
  {
    employeeId: 'E10101',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '年度生成',
    overall: 89,
    dims: {
      basic: d(88, '司龄 9 年'),
      biz: d(94, '年度降本 12% 主导'),
      contribution: d(86, '跨部门改进 5 项'),
      duty: d(90, 'P4 履职全维达标'),
      knowledge: d(86, '结构设计专家'),
      ability: d(88, '问题定义能力强'),
      perf: d(97, '年度 S（97 分）'),
    },
    summary:
      '沈鹿溪为机械设计部核心人才，业绩与履职双高。继任候选标签成立，但存在 MID 流动性信号，建议启动保留动作。',
  },
  {
    employeeId: 'E10111',
    version: 'v2025Q3',
    generatedAt: '2026-09-20',
    source: '年度生成',
    overall: 83,
    dims: {
      basic: d(82, '司龄 8 年'),
      biz: d(86, '工艺良率提升 3.2pct'),
      contribution: d(78, '师带徒 2 人出师'),
      duty: d(84, 'T4 履职达标'),
      knowledge: d(80, '工艺参数库建设者'),
      ability: d(82, '现场问题攻坚'),
      perf: d(90, '年度 A（90 分）'),
    },
    summary:
      '林听澜是工艺工程部继任候选，良率改进成果可直接量化。建议补充跨车间轮岗经历以支撑 T5/管理双通道选择。',
  },
];

export const profiles: ProfileSnapshot[] = [...LIN_VERSIONS, ...SNAPSHOTS];

/** 按员工取最新版本画像；无手工数据时用绩效数据确定性生成兜底 */
export function latestProfile(employeeId: string): ProfileSnapshot {
  const list = profiles.filter((p) => p.employeeId === employeeId);
  if (list.length > 0) return list[list.length - 1];
  return generatedProfile(employeeId);
}

export function profileVersions(employeeId: string): ProfileSnapshot[] {
  return profiles.filter((p) => p.employeeId === employeeId);
}

/** 兜底生成：用绩效分推导七维（画像数据缺失时标记「初排」） */
export function generatedProfile(employeeId: string): ProfileSnapshot {
  // 确定性伪随机：同一员工每次生成一致
  let seed = 0;
  for (const ch of employeeId) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const jitter = (base: number) => Math.max(40, Math.min(96, base + ((seed % 9) - 4)));
  const perf = Number(employeeId.slice(1)) % 40 + 55;
  return {
    employeeId,
    version: 'v2025Q3 初排',
    generatedAt: '2026-09-20',
    source: '引擎初排',
    overall: Math.round(jitter(perf)),
    dims: {
      basic: d(jitter(perf - 6), '引擎初排：待补司龄/学历核验'),
      biz: d(jitter(perf - 4), '引擎初排：来源于绩效中心'),
      contribution: d(jitter(perf - 10), '引擎初排：待管理者确认'),
      duty: d(jitter(perf - 3), '引擎初排：待认证数据回写'),
      knowledge: d(jitter(perf - 8), '引擎初排：待测评数据接入'),
      ability: d(jitter(perf - 7), '引擎初排：待测评数据接入'),
      perf: d(jitter(perf), '来源于年度绩效结果'),
    },
    summary: '该画像由引擎按绩效数据初排生成，部分维度待数据接入后回写。',
  };
}

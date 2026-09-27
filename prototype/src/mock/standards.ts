import type { StandardSummary } from '@/types';

export const standards: StandardSummary[] = [
  { id: 'std_sw', sequence: 'SW', sequenceName: '软件研发序列', grades: 6, duties: 42, knowledges: 68, abilities: 12, version: 'v2.3', status: '生效', updatedAt: '2026-08-12' },
  { id: 'std_eng', sequence: 'ENG', sequenceName: '机械工程序列', grades: 6, duties: 38, knowledges: 54, abilities: 12, version: 'v2.1', status: '生效', updatedAt: '2026-07-30' },
  { id: 'std_op', sequence: 'OP', sequenceName: '工艺操作序列', grades: 5, duties: 30, knowledges: 46, abilities: 8, version: 'v1.8', status: '生效', updatedAt: '2026-06-18' },
  { id: 'std_hr', sequence: 'HR', sequenceName: '人力资源序列', grades: 4, duties: 22, knowledges: 30, abilities: 10, version: 'v1.2', status: '评审中', updatedAt: '2026-09-20' },
  { id: 'std_sal', sequence: 'SAL', sequenceName: '销售序列', grades: 4, duties: 24, knowledges: 28, abilities: 8, version: 'v1.5', status: '草稿', updatedAt: '2026-09-15' },
];

/** 示例：SW-P3 标准详情（批次 2 完整呈现，此处供地基验证） */
export const swP3Standard = {
  sequence: 'SW',
  grade: 'P3',
  version: 'v2.3',
  basic: {
    education: '本科及以上',
    workYears: '3 年以上相关经验',
    companyYears: '司龄满 1 年',
    certificates: '无硬性要求',
  },
  perfCondition: '近一年绩效 B 级以上',
  duties: [
    { name: '模块详细设计', task: '独立完成模块级详细设计与评审', standard: '设计文档通过评审，无重大返工', level: 3 },
    { name: '编码实现', task: '按规范完成核心模块编码', standard: '代码评审一次通过率 ≥ 80%', level: 3 },
    { name: '缺陷修复', task: '定位并修复线上复杂缺陷', standard: 'SLA 内闭环，输出根因分析', level: 2 },
    { name: '技术改进', task: '参与组件/工具改进', standard: '至少 1 项改进被团队采纳', level: 2 },
  ],
  knowledges: [
    { type: 3, name: '数据结构与算法', mastery: 3, examMode: '问答' },
    { type: 3, name: '分布式系统基础', mastery: 2, examMode: '填空' },
    { type: 4, name: 'Git / CI-CD 工具链', mastery: 3, examMode: '问答' },
    { type: 1, name: '信息安全合规基础', mastery: 1, examMode: '选择' },
  ],
  abilities: [
    { name: '客户导向', level: 2, behavior: '主动澄清需求背后的真实问题' },
    { name: '协同推进', level: 2, behavior: '跨角色协作时信息同步及时、承诺可兑现' },
    { name: '系统思维', level: 1, behavior: '能识别改动对上下游模块的影响' },
  ],
  contribution: '担任新人带教导师 1 人次，或参与 2 次以上内部技术分享',
};

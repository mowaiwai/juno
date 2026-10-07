// P3 远期能力 mock 数据
import type { JobEvaluation, IncentiveRecord, Questionnaire, PanoramaSummary, TurnoverConfig, TurnoverRiskReport } from '@/api/p3Forward'

export const jobEvals: JobEvaluation[] = [
  {
    id: 'ev-001', tenant_id: 't1', position_name: '高级后端工程师', dept_id: '300',
    factor_scores: [
      { key: 'knowledge', score: 4, weight: 0.25, name: '知识与技能', weighted: 1 },
      { key: 'responsibility', score: 3, weight: 0.25, name: '责任', weighted: 0.75 },
      { key: 'complexity', score: 4, weight: 0.2, name: '工作复杂度', weighted: 0.8 },
      { key: 'conditions', score: 2, weight: 0.1, name: '工作条件', weighted: 0.2 },
      { key: 'impact', score: 3, weight: 0.2, name: '管理与沟通影响', weighted: 0.6 },
    ],
    total_score: 3.35, grade: 'P3', status: 'published', notes: '点因素法评估',
    evaluated_by: 'u1', evaluated_at: '2026-09-15T10:00:00Z',
  },
  {
    id: 'ev-002', tenant_id: 't1', position_name: '产品经理', dept_id: '200',
    factor_scores: [
      { key: 'knowledge', score: 3, weight: 0.25, name: '知识与技能', weighted: 0.75 },
      { key: 'responsibility', score: 4, weight: 0.25, name: '责任', weighted: 1 },
      { key: 'complexity', score: 3, weight: 0.2, name: '工作复杂度', weighted: 0.6 },
      { key: 'conditions', score: 2, weight: 0.1, name: '工作条件', weighted: 0.2 },
      { key: 'impact', score: 4, weight: 0.2, name: '管理与沟通影响', weighted: 0.8 },
    ],
    total_score: 3.35, grade: 'P3', status: 'draft', notes: '',
    evaluated_by: 'u1', evaluated_at: null,
  },
]

export const incentives: IncentiveRecord[] = [
  { id: 'inc-001', tenant_id: 't1', employee_id: 'e1', category: 'benefit', item_name: '住房补贴', amount: 2000, currency: 'CNY', granted_at: '2026-01-01', effective_from: '2026-01-01', effective_to: '2026-12-31', status: 'active', note: '' },
  { id: 'inc-002', tenant_id: 't1', employee_id: 'e2', category: 'equity', item_name: '期权授予', amount: 50000, currency: 'CNY', granted_at: '2026-03-01', effective_from: '2026-03-01', effective_to: '2030-03-01', status: 'active', note: '4 年归属' },
  { id: 'inc-003', tenant_id: 't1', employee_id: 'e3', category: 'honor', item_name: '年度优秀员工', amount: null, currency: null, granted_at: '2026-07-01', effective_from: '2026-07-01', effective_to: null, status: 'active', note: '2025 年度评选' },
]

export const questionnaires: Questionnaire[] = [
  {
    id: 'q-001', tenant_id: 't1', title: '2026 年度盘点问卷', q_type: 'inventory',
    questions: [
      { text: '请描述该岗位的核心职责与关键任务。', dimension: 'responsibility', level: 1, options: [] },
      { text: '该岗位所需的知识技能等级（1-5），请举例说明。', dimension: 'knowledge', level: 2, options: [] },
      { text: '该岗位的工作复杂度如何？', dimension: 'complexity', level: 3, options: [] },
    ],
    source: 'rule_based', status: 'draft', created_by: 'u1',
  },
]

export const panorama: PanoramaSummary = {
  tenant_id: 't1',
  systems: {
    standard: { name: '标准体系', metric: '标准集数', value: 8 },
    selection: { name: '选聘体系', metric: '招聘需求数', value: 12 },
    evaluation: { name: '评价体系', metric: '盘点批次数', value: 3 },
    incentive: { name: '激励体系', metric: '调薪方案数', value: 2 },
    development: { name: '发展体系', metric: 'IDP 数', value: 45 },
  },
  total_employees: 326,
}

export const turnoverConfig: TurnoverConfig = {
  thresholds: {
    low_perf_grades: ['C', 'D'],
    high_perf_grades: ['S', 'A'],
    stale_raise_months: 18,
    stale_promotion_months: 36,
  },
  weights: { low_perf: 2, stale_raise: 1, high_perf_stale_raise: 2, stale_promotion: 1 },
  buckets: { medium: 2, high: 4 },
  is_default: true,
}

export const turnoverReport: TurnoverRiskReport = {
  generated_at: '2026-10-07T00:00:00Z',
  engine: 'rule_based',
  disclaimer: '本结果由显式信号规则计算，非概率预测，仅供 HR 参考，不自动触发任何人事动作。',
  summary: { high: 2, medium: 5, low: 319, total_scanned: 326 },
  items: [
    {
      employee_id: 'e-101', name: '周屿深', dept_id: '300', position: '后端工程师', grade: 'P3',
      perf_grade: 'C', score: 3, bucket: 'high',
      signals: [
        { key: 'low_perf', label: '当期绩效偏低', detail: '当期绩效 C' },
        { key: 'stale_raise', label: '久未调薪', detail: '距上次调薪 24 个月' },
      ],
    },
    {
      employee_id: 'e-102', name: '林见微', dept_id: '200', position: '产品经理', grade: 'P3',
      perf_grade: 'A', score: 3, bucket: 'high',
      signals: [
        { key: 'stale_raise', label: '久未调薪', detail: '距上次调薪 21 个月' },
        { key: 'high_perf_stale_raise', label: '高绩效却久未调薪（薪酬倒挂）', detail: '绩效 A 但 21 个月未调薪' },
      ],
    },
  ],
}

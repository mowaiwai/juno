import { api } from './client'
import { USE_MOCK } from './config'
import * as mock from '@/mock/p3Forward'

// ==================== 岗位价值评估 ====================

export interface FactorScore {
  key: string
  score: number
  weight: number
  name?: string
  weighted?: number
}

export interface JobEvaluation {
  id: string
  tenant_id: string
  position_name: string
  dept_id: string | null
  factor_scores: FactorScore[]
  total_score: number
  grade: string | null
  status: string
  notes: string
  evaluated_by: string | null
  evaluated_at: string | null
}

export const defaultFactors = () =>
  api.get<any[]>('/p3/job-eval/default-factors')

export const listJobEvals = () =>
  USE_MOCK
    ? Promise.resolve(mock.jobEvals)
    : api.get<JobEvaluation[]>('/p3/job-evals')

export const createJobEval = (data: Partial<JobEvaluation>) =>
  api.post<JobEvaluation>('/p3/job-evals', data)

export const updateJobEval = (id: string, data: Partial<JobEvaluation>) =>
  api.put<JobEvaluation>(`/p3/job-evals/${id}`, data)

export const deleteJobEval = (id: string) =>
  api.delete<void>(`/p3/job-evals/${id}`).then(() => true)

// ==================== 激励记录（津贴/股权/荣誉） ====================

export type IncentiveCategory = 'benefit' | 'equity' | 'honor'

export interface IncentiveRecord {
  id: string
  tenant_id: string
  employee_id: string
  category: IncentiveCategory
  item_name: string
  amount: number | null
  currency: string | null
  granted_at: string | null
  effective_from: string | null
  effective_to: string | null
  status: string
  note: string | null
}

export const listIncentives = (params?: { employee_id?: string; category?: string }) =>
  USE_MOCK
    ? Promise.resolve(mock.incentives)
    : api.get<IncentiveRecord[]>('/p3/incentives', params)

export const createIncentive = (data: Partial<IncentiveRecord>) =>
  api.post<IncentiveRecord>('/p3/incentives', data)

export const updateIncentive = (id: string, data: Partial<IncentiveRecord>) =>
  api.put<IncentiveRecord>(`/p3/incentives/${id}`, data)

export const deleteIncentive = (id: string) =>
  api.delete<void>(`/p3/incentives/${id}`).then(() => true)

// ==================== 问卷 ====================

export interface Questionnaire {
  id: string
  tenant_id: string
  title: string
  q_type: string
  questions: any[]
  source: string
  status: string
  created_by: string | null
}

export const listQuestionnaires = () =>
  USE_MOCK
    ? Promise.resolve(mock.questionnaires)
    : api.get<Questionnaire[]>('/p3/questionnaires')

export const generateQuestionnaire = (data: { title: string; q_type: string; focus?: string }) =>
  api.post<Questionnaire>('/p3/questionnaires/generate', data)

export const deleteQuestionnaire = (id: string) =>
  api.delete<void>(`/p3/questionnaires/${id}`).then(() => true)

// ==================== 判断辅助 ====================

export interface PromotionPrescreen {
  application_id: string
  missing_fields: string[]
  complete: boolean
  ai_review: string
  suggested_questions: string[]
  source: string
}

export const prescreenPromotion = (applicationId: string) =>
  api.post<PromotionPrescreen>(
    `/p3/judge/promotion-prescreen?application_id=${encodeURIComponent(applicationId)}`,
  )

export interface SalaryEligibility {
  employee_id: string
  eligible: boolean
  perf_grade: string | null
  reasons: string[]
  rule_source: string
}

export const checkSalaryEligibility = (employeeId: string) =>
  api.get<SalaryEligibility>(`/p3/judge/salary-adjust-eligibility/${employeeId}`)

// ==================== 五体系全景 ====================

export interface PanoramaSummary {
  tenant_id: string
  systems: Record<string, { name: string; metric: string; value: number }>
  total_employees: number
}

export const getPanoramaSummary = () =>
  USE_MOCK
    ? Promise.resolve(mock.panorama)
    : api.get<PanoramaSummary>('/p3/panorama/summary')

// ==================== 离职风险预警 ====================

export interface TurnoverSignal {
  key: string
  label: string
  detail: string
}

export interface TurnoverRiskItem {
  employee_id: string
  name: string
  dept_id: string
  position: string
  grade: string
  perf_grade: string | null
  score: number
  bucket: 'low' | 'medium' | 'high'
  signals: TurnoverSignal[]
}

export interface TurnoverRiskReport {
  generated_at: string
  engine: string
  disclaimer: string
  summary: { high: number; medium: number; low: number; total_scanned: number }
  items: TurnoverRiskItem[]
}

export interface TurnoverConfig {
  thresholds: Record<string, number | string[]>
  weights: Record<string, number>
  buckets: Record<string, number>
  is_default: boolean
}

export const getTurnoverConfig = () =>
  USE_MOCK
    ? Promise.resolve(mock.turnoverConfig)
    : api.get<TurnoverConfig>('/p3/turnover/config')

export const updateTurnoverConfig = (data: Partial<TurnoverConfig>) =>
  api.put<TurnoverConfig>('/p3/turnover/config', data)

export const getTurnoverRisks = (bucket?: string) =>
  USE_MOCK
    ? Promise.resolve(mock.turnoverReport)
    : api.get<TurnoverRiskReport>('/p3/turnover/risks', bucket ? { bucket } : undefined)

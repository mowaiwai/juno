/** 在线考试接口（字段 snake_case，与后端契约一致）。 */
import { api } from './client';
import { USE_MOCK } from './config';

export type PaperStatus = 'pending_review' | 'published' | 'rejected';

export interface ExamQuestionDTO {
  id: string
  sort_order: number
  type: string
  stem: string
  options: string[]
  /** 仅 HR 审核/交卷后回顾存在；开始考试时不下发 */
  answer_index?: number
  score: number
  analysis?: string
}

export interface ExamPaperDTO {
  id: string
  title: string
  description: string
  target_position: string
  target_sequence: string
  target_grade: string
  status: PaperStatus
  source: string
  model: string | null
  duration_minutes: number
  pass_score: number
  total_score: number
  reject_reason: string | null
  created_at: string
  published_at: string | null
  question_count: number
  questions?: ExamQuestionDTO[]
}

export interface GeneratePaperBody {
  title: string
  description?: string
  target_position?: string
  target_sequence?: string
  target_grade?: string
  question_count: number
  duration_minutes: number
  pass_score: number
}

/** 开始考试的下发结构（无答案） */
export interface StartDTO {
  attempt_id: string
  paper_id: string
  title: string
  duration_minutes: number
  pass_score: number
  total_score: number
  started_at: string
  questions: {
    id: string
    sort_order: number
    stem: string
    options: string[]
    score: number
  }[]
}

export interface GradedQuestionDTO {
  id: string
  sort_order: number
  stem: string
  options: string[]
  score: number
  selected_index: number | null
  answer_index: number
  correct: boolean
}

export interface AttemptDTO {
  id: string
  paper_id: string
  paper_title: string
  status: 'in_progress' | 'submitted'
  score: number
  total_score: number
  passed: boolean
  started_at: string
  submitted_at: string | null
  questions?: GradedQuestionDTO[]
  /** mock 内部记录的作答（后端不随 AttemptOut 下发） */
  answers?: Record<string, number>
}

// ---------------------------------------------------------------------------
// Mock 实现（内存态，刷新重置；用于无后端的 UI 开发）
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString()

function mockSeedQuestions(): ExamQuestionDTO[] {
  return [
    {
      id: 'mq1', sort_order: 1, type: 'single_choice',
      stem: 'LRU 缓存适合用哪种数据结构实现？',
      options: ['哈希表+双向链表', '数组', '栈', '队列'],
      answer_index: 0, score: 10,
      analysis: '哈希表 O(1) 定位，双向链表维护访问顺序。',
    },
    {
      id: 'mq2', sort_order: 2, type: 'single_choice',
      stem: 'CAP 定理不包含以下哪一项？',
      options: ['一致性', '可用性', '可观测性', '分区容错性'],
      answer_index: 2, score: 10,
      analysis: 'CAP 为一致性、可用性、分区容错性。',
    },
  ]
}

let mockPapers: ExamPaperDTO[] = [
  {
    id: 'mp_published',
    title: '软件工程师 P3 认证考试',
    description: '覆盖 P3 职级应掌握的数据结构与分布式知识',
    target_position: '软件工程师',
    target_sequence: '技术',
    target_grade: 'P3',
    status: 'published',
    source: 'ai',
    model: 'mock-model',
    duration_minutes: 30,
    pass_score: 20,
    total_score: 20,
    reject_reason: null,
    created_at: now(),
    published_at: now(),
    question_count: 2,
    questions: mockSeedQuestions(),
  },
  {
    id: 'mp_pending',
    title: '大客户经理知识考试',
    description: 'AI 依据大客户经理任职标准生成',
    target_position: '大客户经理',
    target_sequence: '销售',
    target_grade: 'M2',
    status: 'pending_review',
    source: 'ai',
    model: 'mock-model',
    duration_minutes: 45,
    pass_score: 60,
    total_score: 60,
    reject_reason: null,
    created_at: now(),
    published_at: null,
    question_count: 6,
  },
]

let mockAttempts: AttemptDTO[] = []

const delay = <T,>(v: T, ms = 400): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(v), ms))

export const examApi = {
  listPapers: (): Promise<ExamPaperDTO[]> => {
    if (USE_MOCK) return delay(mockPapers.map((p) => ({ ...p, questions: undefined })))
    return api.get<ExamPaperDTO[]>('/exam/papers')
  },

  getPaper: (id: string): Promise<ExamPaperDTO> => {
    if (USE_MOCK) {
      const p = mockPapers.find((x) => x.id === id)
      return delay(structuredClone(p) as ExamPaperDTO)
    }
    return api.get<ExamPaperDTO>(`/exam/papers/${id}`)
  },

  generatePaper: (body: GeneratePaperBody): Promise<ExamPaperDTO> => {
    if (USE_MOCK) {
      const total = body.question_count * 10
      const paper: ExamPaperDTO = {
        id: `mp_${Date.now()}`,
        title: body.title,
        description: body.description ?? '',
        target_position: body.target_position ?? '',
        target_sequence: body.target_sequence ?? '',
        target_grade: body.target_grade ?? '',
        status: 'pending_review',
        source: 'ai',
        model: 'mock-model',
        duration_minutes: body.duration_minutes,
        pass_score: body.pass_score,
        total_score: total,
        reject_reason: null,
        created_at: now(),
        published_at: null,
        question_count: body.question_count,
      }
      mockPapers = [paper, ...mockPapers]
      return delay(structuredClone(paper), 800)
    }
    return api.post<ExamPaperDTO>('/exam/papers/generate', body)
  },

  approve: (id: string): Promise<ExamPaperDTO> => {
    if (USE_MOCK) {
      const p = mockPapers.find((x) => x.id === id)
      if (p) { p.status = 'published'; p.published_at = now() }
      return delay(structuredClone(p) as ExamPaperDTO)
    }
    return api.post<ExamPaperDTO>(`/exam/papers/${id}/approve`)
  },

  reject: (id: string, reason: string): Promise<ExamPaperDTO> => {
    if (USE_MOCK) {
      const p = mockPapers.find((x) => x.id === id)
      if (p) { p.status = 'rejected'; p.reject_reason = reason }
      return delay(structuredClone(p) as ExamPaperDTO)
    }
    return api.post<ExamPaperDTO>(`/exam/papers/${id}/reject`, { reason })
  },

  start: (paperId: string): Promise<StartDTO> => {
    if (USE_MOCK) {
      const paper = mockPapers.find((p) => p.id === paperId)
      const existing = mockAttempts.find(
        (a) => a.paper_id === paperId && a.status === 'in_progress',
      )
      if (existing) {
        return delay({
          attempt_id: existing.id,
          paper_id: paperId,
          title: paper?.title ?? '',
          duration_minutes: paper?.duration_minutes ?? 60,
          pass_score: paper?.pass_score ?? 60,
          total_score: paper?.total_score ?? 0,
          started_at: existing.started_at,
          questions: (paper?.questions ?? []).map(
            ({ id, sort_order, stem, options, score }) => ({
              id, sort_order, stem, options, score,
            }),
          ),
        })
      }
      const id = `ma_${Date.now()}`
      mockAttempts = [
        {
          id, paper_id: paperId, paper_title: paper?.title ?? '',
          status: 'in_progress', score: 0, total_score: paper?.total_score ?? 0,
          passed: false, started_at: now(), submitted_at: null,
        },
        ...mockAttempts,
      ]
      return delay({
        attempt_id: id,
        paper_id: paperId,
        title: paper?.title ?? '',
        duration_minutes: paper?.duration_minutes ?? 60,
        pass_score: paper?.pass_score ?? 60,
        total_score: paper?.total_score ?? 0,
        started_at: now(),
        questions: (paper?.questions ?? []).map(
          ({ id, sort_order, stem, options, score }) => ({
            id, sort_order, stem, options, score,
          }),
        ),
      })
    }
    return api.post<StartDTO>(`/exam/papers/${paperId}/start`)
  },

  submit: (
    attemptId: string,
    answers: Record<string, number>,
  ): Promise<AttemptDTO> => {
    if (USE_MOCK) {
      const attempt = mockAttempts.find((a) => a.id === attemptId)
      const paper = mockPapers.find((p) => p.id === attempt?.paper_id)
      let score = 0
      const graded: GradedQuestionDTO[] = (paper?.questions ?? []).map((q) => {
        const selected = answers[q.id]
        const correct = selected === q.answer_index
        if (correct) score += q.score
        return {
          id: q.id, sort_order: q.sort_order, stem: q.stem, options: q.options,
          score: q.score,
          selected_index: selected ?? null,
          answer_index: q.answer_index ?? 0,
          correct,
        }
      })
      if (attempt) {
        attempt.answers = answers
        attempt.score = score
        attempt.passed = score >= (paper?.pass_score ?? 60)
        attempt.status = 'submitted'
        attempt.submitted_at = now()
        attempt.questions = graded
      }
      return delay(structuredClone(attempt) as AttemptDTO, 600)
    }
    return api.post<AttemptDTO>(`/exam/attempts/${attemptId}/submit`, { answers })
  },

  listAttempts: (): Promise<AttemptDTO[]> => {
    if (USE_MOCK)
      return delay(mockAttempts.map((a) => ({ ...a, questions: undefined })))
    return api.get<AttemptDTO[]>('/exam/attempts')
  },

  getAttempt: (id: string): Promise<AttemptDTO> => {
    if (USE_MOCK) {
      const a = mockAttempts.find((x) => x.id === id)
      return delay(structuredClone(a) as AttemptDTO)
    }
    return api.get<AttemptDTO>(`/exam/attempts/${id}`)
  },
}

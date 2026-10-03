/** 招聘面试接口。 */
import { api } from './client';
import { USE_MOCK } from './config';
import {
  aiJd,
  candidates as mockCandidates,
  interviewQuestions as mockQuestions,
  requisitions as mockReqs,
} from '@/mock/recruit';

// ============ 类型定义 ============

export interface RequisitionOut {
  id: string;
  tenant_id: string;
  position: string;
  dept_id: string;
  grade: string;
  headcount: number;
  funnel: number[];
  owner: string;
  priority: string;
  opened_at: string;
}

export interface CandidateOut {
  id: string;
  tenant_id: string;
  req_id: string;
  name: string;
  stage: string;
  source: string;
  match_score: number;
  years: number;
  last_title: string;
  expected_salary: number;
  rating: number | null;
  tags: string[];
  applied_at: string;
}

export interface InterviewQuestionOut {
  id: string;
  tenant_id: string;
  dimension: number;
  position: string;
  grade: string;
  question: string;
  answer_point: string | null;
  source: string;
  status: string;
  created_by: string;
}

export interface QuestionGenerateIn {
  position: string;
  grade: string;
  dimension?: number;
  count?: number;
}

export interface InterviewRecordIn {
  candidate_id: string;
  req_id?: string;
  dimension_scores?: unknown[];
  comment?: string;
  rating?: number;
  stage?: string;
}

// ============ 部门名称映射 ============

export const DEPT_NAME_MAP: Record<string, string> = {
  '200': '职能', '201': '人力资源', '202': '质量管理部',
  '300': '研发', '305': '软件研发部', '306': '机械设计部',
  '400': '制造', '500': '供应链', '600': '营销',
};

// ============ Mock 转换 ============

const mockReqToOut = (m: typeof mockReqs[0]): RequisitionOut => ({
  id: m.id, tenant_id: 'mock', position: m.position, dept_id: m.dept,
  grade: m.grade, headcount: m.headcount, funnel: m.funnel,
  owner: m.owner, priority: m.priority, opened_at: m.openedAt,
});

const mockCandToOut = (m: typeof mockCandidates[0]): CandidateOut => ({
  id: m.id, tenant_id: 'mock', req_id: m.reqId, name: m.name,
  stage: m.stage, source: m.source, match_score: m.matchScore,
  years: m.years, last_title: m.lastTitle, expected_salary: m.expectedSalary,
  rating: m.rating ?? null, tags: m.tags, applied_at: m.appliedAt,
});

const mockQToOut = (m: typeof mockQuestions[0]): InterviewQuestionOut => ({
  id: m.id, tenant_id: 'mock', dimension: m.dimension, position: m.position,
  grade: m.grade, question: m.question, answer_point: m.answerPoint ?? null,
  source: m.source, status: m.status, created_by: 'mock',
});

// ============ API ============

export const requisitionApi = {
  list: (): Promise<RequisitionOut[]> => {
    if (USE_MOCK) return Promise.resolve(mockReqs.map(mockReqToOut));
    return api.get<RequisitionOut[]>('/requisitions');
  },
};

export const candidateApi = {
  list: (reqId?: string): Promise<CandidateOut[]> => {
    if (USE_MOCK) {
      const filtered = reqId ? mockCandidates.filter((c) => c.reqId === reqId) : mockCandidates;
      return Promise.resolve(filtered.map(mockCandToOut));
    }
    const path = reqId ? `/candidates?req_id=${reqId}` : '/candidates';
    return api.get<CandidateOut[]>(path);
  },
};

export const interviewApi = {
  list: (dimension?: number, position?: string): Promise<InterviewQuestionOut[]> => {
    if (USE_MOCK) {
      let list = mockQuestions.slice();
      if (dimension) list = list.filter((q) => q.dimension === dimension);
      if (position) list = list.filter((q) => q.position === position);
      return Promise.resolve(list.map(mockQToOut));
    }
    const params = new URLSearchParams();
    if (dimension) params.set('dimension', String(dimension));
    if (position) params.set('position', position);
    const qs = params.toString();
    return api.get<InterviewQuestionOut[]>(`/interview-questions${qs ? '?' + qs : ''}`);
  },

  generate: (body: QuestionGenerateIn): Promise<InterviewQuestionOut[]> => {
    if (USE_MOCK) {
      const dims = body.dimension ? [body.dimension] : [1, 2, 3, 4];
      const newQs = dims.map((d) => ({
        id: `ai_q_${Date.now()}_${d}`,
        tenant_id: 'mock',
        dimension: d,
        position: body.position,
        grade: body.grade,
        question: `AI 生成：${body.position} ${body.grade} 维度${d}面试题`,
        answer_point: 'AI 建议评分要点（待审核）',
        source: 'ai',
        status: 'pending_review',
        created_by: 'mock',
      }));
      return Promise.resolve(newQs);
    }
    return api.post<InterviewQuestionOut[]>('/interview-questions/generate', body);
  },

  review: (questionId: string, approved: boolean): Promise<InterviewQuestionOut> => {
    if (USE_MOCK) {
      const q = mockQuestions.find((x) => x.id === questionId);
      if (q) q.status = approved ? 'approved' : 'rejected';
      return Promise.resolve(q ? mockQToOut(q) : Promise.reject(new Error('not found')));
    }
    return api.put<InterviewQuestionOut>(`/interview-questions/${questionId}/review`, { approved });
  },

  saveRecord: (body: InterviewRecordIn): Promise<unknown> => {
    if (USE_MOCK) return Promise.resolve({ id: `rec_${Date.now()}`, ...body });
    return api.post('/interview-records', body);
  },

  compare: (candidateId: string, position?: string): Promise<unknown> => {
    if (USE_MOCK) {
      const c = mockCandidates.find((x) => x.id === candidateId);
      return Promise.resolve(c ? { candidate_id: c.id, name: c.name, match_score: c.matchScore, rating: c.rating, records: [] } : {});
    }
    const qs = position ? `&position=${position}` : '';
    return api.get(`/interview-records/compare?candidate_id=${candidateId}${qs}`);
  },
};

/** AI JD mock（前端独有，后端无对应接口） */
export const aiJdData = aiJd;

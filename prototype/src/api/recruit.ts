/** 招聘面试接口。 */
import { api } from './client';
import { USE_MOCK } from './config';
import {
  aiJd,
  candidates as mockCandidates,
  CandStage,
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
  prescreen_score: number | null;
}

export interface InterviewQuestionOut {
  id: string;
  tenant_id: string;
  dimension: number;
  dimension_key: string;
  position: string;
  grade: string;
  sequence: string;
  question: string;
  answer_point: string | null;
  rubric: { level: number; desc: string }[];
  source: string;
  status: string;
  created_by: string;
}

export interface QuestionGenerateIn {
  position: string;
  grade: string;
  dimension?: number;
  sequence?: string;
  count?: number;
}

export interface PrescreenOut {
  candidate_id: string;
  prescreen_score: number;
  breakdown: Record<string, number>;
  level: 'good' | 'watch' | 'mismatch';
}

export interface InterviewRecordIn {
  candidate_id: string;
  req_id?: string;
  dimension_scores?: unknown[];
  comment?: string;
  rating?: number;
  stage?: string;
}

export interface RequisitionIn {
  position: string;
  dept_id: string;
  grade: string;
  headcount?: number;
  owner: string;
  priority?: string;
  opened_at?: string;
}

export interface CandidateIn {
  req_id: string;
  name: string;
  source: string;
  years?: number;
  last_title?: string;
  expected_salary?: number;
  tags?: string[];
}

export interface OnboardOut {
  candidate_id: string;
  employee_id: string;
  user_id: string;
  employee_no: string;
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

const MOCK_DIM_KEY: Record<number, string> = {
  1: 'duty', 2: 'knowledge', 3: 'ability', 4: 'perf', 5: 'contribution',
};

const mockCandToOut = (m: typeof mockCandidates[0]): CandidateOut => ({
  id: m.id, tenant_id: 'mock', req_id: m.reqId, name: m.name,
  stage: m.stage, source: m.source, match_score: m.matchScore,
  years: m.years, last_title: m.lastTitle, expected_salary: m.expectedSalary,
  rating: m.rating ?? null, tags: m.tags, applied_at: m.appliedAt,
  prescreen_score: (m as { prescreenScore?: number }).prescreenScore ?? null,
});

const mockQToOut = (m: typeof mockQuestions[0]): InterviewQuestionOut => ({
  id: m.id, tenant_id: 'mock', dimension: m.dimension,
  dimension_key: MOCK_DIM_KEY[m.dimension] ?? '',
  position: m.position, grade: m.grade, sequence: '',
  question: m.question, answer_point: m.answerPoint ?? null,
  rubric: [], source: m.source, status: m.status, created_by: 'mock',
});

// ============ API ============

export const requisitionApi = {
  list: (): Promise<RequisitionOut[]> => {
    if (USE_MOCK) return Promise.resolve(mockReqs.map(mockReqToOut));
    return api.get<RequisitionOut[]>('/requisitions');
  },
  create: (body: RequisitionIn): Promise<RequisitionOut> => {
    if (USE_MOCK) {
      const req: RequisitionOut = {
        id: `req_${Date.now()}`,
        tenant_id: 'mock',
        position: body.position,
        dept_id: body.dept_id,
        grade: body.grade,
        headcount: body.headcount ?? 1,
        funnel: [0, 0, 0, 0, 0],
        owner: body.owner,
        priority: body.priority ?? 'mid',
        opened_at: body.opened_at || new Date().toISOString().slice(0, 10),
      };
      mockReqs.push({
        id: req.id, position: req.position, dept: req.dept_id, grade: req.grade,
        headcount: req.headcount, funnel: req.funnel, owner: req.owner,
        priority: req.priority as 'high' | 'mid', openedAt: req.opened_at,
      });
      return Promise.resolve(req);
    }
    return api.post<RequisitionOut>('/requisitions', body);
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
  create: (body: CandidateIn): Promise<CandidateOut> => {
    if (USE_MOCK) {
      const cand: CandidateOut = {
        id: `cand_${Date.now()}`,
        tenant_id: 'mock',
        req_id: body.req_id,
        name: body.name,
        stage: 'screen',
        source: body.source,
        match_score: 0,
        years: body.years ?? 0,
        last_title: body.last_title ?? '',
        expected_salary: body.expected_salary ?? 0,
        rating: null,
        tags: body.tags ?? [],
        applied_at: new Date().toISOString().slice(0, 10),
        prescreen_score: null,
      };
      mockCandidates.push({
        id: cand.id, reqId: cand.req_id, name: cand.name, stage: cand.stage as CandStage,
        source: cand.source, matchScore: cand.match_score, years: cand.years,
        lastTitle: cand.last_title, expectedSalary: cand.expected_salary,
        rating: undefined, tags: cand.tags, appliedAt: cand.applied_at,
      });
      return Promise.resolve(cand);
    }
    return api.post<CandidateOut>('/candidates', body);
  },
  updateStage: (id: string, stage: string): Promise<CandidateOut> => {
    if (USE_MOCK) {
      const m = mockCandidates.find((c) => c.id === id);
      if (m) m.stage = stage as CandStage;
      return Promise.resolve(m ? mockCandToOut(m) : Promise.reject(new Error('not found')));
    }
    return api.put<CandidateOut>(`/candidates/${id}/stage`, { stage });
  },
  onboard: (id: string): Promise<OnboardOut> => {
    if (USE_MOCK) {
      const m = mockCandidates.find((c) => c.id === id);
      if (m) m.stage = 'onboard';
      return Promise.resolve({
        candidate_id: id,
        employee_id: `emp_${Date.now()}`,
        user_id: `user_${Date.now()}`,
        employee_no: `E${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      });
    }
    return api.post<OnboardOut>(`/candidates/${id}/onboard`);
  },
  prescreen: (id: string): Promise<PrescreenOut> => {
    if (USE_MOCK) {
      return Promise.resolve({
        candidate_id: id,
        prescreen_score: 75,
        breakdown: { years: 30, title: 20, tags: 25 },
        level: 'watch',
      });
    }
    return api.post<PrescreenOut>(`/candidates/${id}/prescreen`);
  },
};

export const interviewApi = {
  list: (dimension?: number, position?: string, sequence?: string): Promise<InterviewQuestionOut[]> => {
    if (USE_MOCK) {
      let list = mockQuestions.slice();
      if (dimension) list = list.filter((q) => q.dimension === dimension);
      if (position) list = list.filter((q) => q.position === position);
      return Promise.resolve(list.map(mockQToOut));
    }
    const params = new URLSearchParams();
    if (dimension) params.set('dimension', String(dimension));
    if (position) params.set('position', position);
    if (sequence) params.set('sequence', sequence);
    const qs = params.toString();
    return api.get<InterviewQuestionOut[]>(`/interview-questions${qs ? '?' + qs : ''}`);
  },

  generate: (body: QuestionGenerateIn): Promise<InterviewQuestionOut[]> => {
    if (USE_MOCK) {
      const dims = body.dimension ? [body.dimension] : [1, 2, 3, 4, 5];
      const newQs = dims.map((d) => ({
        id: `ai_q_${Date.now()}_${d}`,
        tenant_id: 'mock',
        dimension: d,
        dimension_key: MOCK_DIM_KEY[d] ?? '',
        position: body.position,
        grade: body.grade,
        sequence: body.sequence ?? '',
        question: `AI 生成：${body.position} ${body.grade} 维度${d}面试题`,
        answer_point: 'AI 建议评分要点（待审核）',
        rubric: [
          { level: 1, desc: '不达标' }, { level: 2, desc: '待提升' }, { level: 3, desc: '达标' },
          { level: 4, desc: '良好' }, { level: 5, desc: '卓越' },
        ],
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

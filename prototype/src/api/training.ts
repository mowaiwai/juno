/**
 * 人才发展 API：培训管理 / 经验萃取库 / 学习地图。
 * 契约对齐 backend/app/schemas/training.py。
 */
import { api } from './client';
import { USE_MOCK } from './config';

// ============ 课程 ============
export type CourseType = 'internal' | 'micro' | 'bootcamp' | 'external';
export type CourseStatus = 'enrolling' | 'ongoing' | 'completed';

export interface CourseIn {
  name: string;
  type: CourseType;
  category: string;
  instructor_name: string;
  hours?: number;
  enrolled?: number;
  completion?: number;
  status?: CourseStatus;
  started_at?: string | null;
}
export type CourseUpdate = Partial<CourseIn>;
export interface CourseOut {
  id: string;
  name: string;
  type: CourseType;
  category: string;
  instructor_name: string;
  hours: number;
  enrolled: number;
  completion: number;
  status: CourseStatus;
  started_at: string | null;
  created_at: string;
}

export const COURSE_TYPE_LABEL: Record<CourseType, string> = {
  internal: '内训', micro: '微课', bootcamp: '训练营', external: '外训',
};
export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  enrolling: '招生中', ongoing: '进行中', completed: '已结项',
};

// ============ 讲师 ============
export interface InstructorIn {
  name: string;
  field: string;
  rating?: number;
  internal?: boolean;
}
export type InstructorUpdate = Partial<InstructorIn>;
export interface InstructorOut extends InstructorIn { id: string; }

// ============ 经验萃取 ============
export type ExtractWay = 'interview' | 'ai';
export type KnowledgeStatus = 'draft' | 'extracting' | 'published';

export interface KnowledgeIn {
  title: string;
  category: string;
  author: string;
  way?: ExtractWay;
  summary?: string;
  status?: KnowledgeStatus;
}
export type KnowledgeUpdate = Partial<KnowledgeIn>;
export interface KnowledgeOut {
  id: string;
  title: string;
  category: string;
  author: string;
  way: ExtractWay;
  summary: string;
  status: KnowledgeStatus;
  reads: number;
  likes: number;
  created_at: string;
}

export const KNOWLEDGE_STATUS_META: Record<KnowledgeStatus, { label: string; bg: string; color: string }> = {
  published: { label: '已发布', bg: 'var(--sage-soft)', color: 'var(--sage)' },
  extracting: { label: 'AI 萃取中', bg: 'var(--clay-soft)', color: 'var(--clay)' },
  draft: { label: '草稿', bg: 'var(--surface-sunken)', color: 'var(--ink-3)' },
};

// ============ 学习地图 ============
export interface LearningPathIn {
  position: string;
  grade: string;
  course_name: string;
  learn_type?: number;
  mastery?: number;
  exam_mode: string;
  duration?: string;
}
export type LearningPathUpdate = Partial<LearningPathIn>;
export interface LearningPathOut {
  id: string;
  position: string;
  grade: string;
  course_name: string;
  learn_type: number;
  mastery: number;
  exam_mode: string;
  duration: string;
}

export const LEARN_TYPE_LABEL = { 1: '必修', 2: '选修', 3: '认证前置' } as Record<number, string>;
export const LEARN_TYPE_COLOR = { 1: 'var(--clay)', 2: 'var(--teal)', 3: 'var(--ochre)' } as Record<number, string>;
export const MASTERY_LABEL = { 1: '了解', 2: '掌握', 3: '熟练掌握', 4: '精通' } as Record<number, string>;

// ============ 新员工 180 天路径 ============
export interface OnboardingStage { stage: string; items: string[]; }

// ============ Mock 数据 ============
const MOCK_COURSES: CourseOut[] = [
  { id: 'CR01', name: 'P4 认证知识串讲 · 分布式与工程实践', type: 'bootcamp', category: '任职资格', instructor_name: '江予安', hours: 24, enrolled: 18, completion: 62, status: 'ongoing', started_at: '2026-09-02', created_at: '2026-09-01' },
  { id: 'CR02', name: '新员工 180 天 · 入职引导与质量意识', type: 'internal', category: '新人融入', instructor_name: '温晚晴', hours: 8, enrolled: 12, completion: 100, status: 'completed', started_at: '2026-08-11', created_at: '2026-08-10' },
  { id: 'CR03', name: '数控加工微课系列（12 讲）', type: 'micro', category: '技能提升', instructor_name: '唐雨时', hours: 6, enrolled: 34, completion: 71, status: 'ongoing', started_at: '2026-08-20', created_at: '2026-08-19' },
  { id: 'CR04', name: '大客户销售方法论', type: 'external', category: '业务赋能', instructor_name: '外部讲师', hours: 16, enrolled: 8, completion: 0, status: 'enrolling', started_at: '2026-10-10', created_at: '2026-09-20' },
  { id: 'CR05', name: '六西格玛绿带认证班', type: 'bootcamp', category: '质量体系', instructor_name: '冯柚', hours: 40, enrolled: 15, completion: 35, status: 'ongoing', started_at: '2026-09-08', created_at: '2026-09-05' },
  { id: 'CR06', name: '新晋管理者 90 天转身', type: 'bootcamp', category: '管理发展', instructor_name: '沈既明', hours: 20, enrolled: 6, completion: 0, status: 'enrolling', started_at: '2026-10-15', created_at: '2026-09-25' },
];
const MOCK_INSTRUCTORS: InstructorOut[] = [
  { id: 'T01', name: '江予安', field: '软件架构', rating: 4.8, internal: true },
  { id: 'T02', name: '唐雨时', field: '数控加工', rating: 4.9, internal: true },
  { id: 'T03', name: '冯柚', field: '质量体系', rating: 4.7, internal: true },
  { id: 'T04', name: '沈既明', field: '管理实践', rating: 4.6, internal: true },
];
const MOCK_ONBOARDING: OnboardingStage[] = [
  { stage: '第 1–7 天 · 入职引导', items: ['企业文化与制度', '安全与保密', '导师配对'] },
  { stage: '第 8–30 天 · 基础培训', items: ['岗位基础课', '质量意识', '工具权限开通'] },
  { stage: '第 31–90 天 · 带教实操', items: ['跟岗任务', '首个独立任务', '30 天面谈'] },
  { stage: '第 91–150 天 · 训练营', items: ['序列训练营', '阶段考试', '90 天面谈'] },
  { stage: '第 151–180 天 · 轮岗/定岗', items: ['轮岗体验（可选）', '定岗评估', '转正答辩'] },
];
const MOCK_KNOWLEDGE: KnowledgeOut[] = [
  { id: 'KB01', title: '江予安：核心系统性能优化 8 步法', category: '软件研发', author: '江予安', way: 'interview', status: 'published', reads: 286, likes: 42, summary: '从基线压测到链路拆解，沉淀一套可复用的性能优化流程与检查清单。', created_at: '2026-08-15' },
  { id: 'KB02', title: '唐雨时：薄壁件加工变形控制经验', category: '制造工艺', author: '唐雨时', way: 'interview', status: 'published', reads: 198, likes: 38, summary: '装夹方式、走刀路径与冷却参数的配合，老师傅三十年的实战参数表。', created_at: '2026-07-30' },
  { id: 'KB03', title: '秦越：大客户从线索到回款的打法拆解', category: '销售实战', author: '秦越', way: 'ai', status: 'published', reads: 342, likes: 56, summary: 'AI 访谈萃取：关键人地图、需求分层、竞争卡位与风险条款处理。', created_at: '2026-09-01' },
  { id: 'KB04', title: '装配一次交检合格率提升攻关纪要', category: '质量改进', author: '冯柚', way: 'ai', status: 'extracting', reads: 0, likes: 0, summary: 'AI 正在从攻关会议纪要与数据报表中萃取问题树与对策（进行中）。', created_at: '2026-09-25' },
  { id: 'KB05', title: '新员工导师带教手册（2026 版）', category: '人才培养', author: '温晚晴', way: 'interview', status: 'draft', reads: 0, likes: 0, summary: '带教节奏、沟通模板与转正评估表，草稿待评审。', created_at: '2026-09-20' },
  { id: 'KB06', title: '林听澜：工艺切换快速换模 SOP', category: '制造工艺', author: '林听澜', way: 'ai', status: 'published', reads: 154, likes: 27, summary: '内外作业分离、模具预置与首件确认，换模时间缩短 40%。', created_at: '2026-08-28' },
];
const MOCK_PATHS: LearningPathOut[] = [
  { id: 'LP01', position: '软件研发工程师', grade: 'P3', course_name: '编程规范与代码评审', learn_type: 1, mastery: 2, exam_mode: '填空题', duration: '8h' },
  { id: 'LP02', position: '软件研发工程师', grade: 'P3', course_name: '单元测试与持续集成', learn_type: 1, mastery: 2, exam_mode: '填空题', duration: '6h' },
  { id: 'LP03', position: '软件研发工程师', grade: 'P4', course_name: '分布式系统基础', learn_type: 1, mastery: 3, exam_mode: '问答题', duration: '24h' },
  { id: 'LP04', position: '软件研发工程师', grade: 'P4', course_name: '系统设计与架构', learn_type: 2, mastery: 4, exam_mode: '答辩', duration: '16h' },
  { id: 'LP05', position: '软件研发工程师', grade: 'P5', course_name: '高并发与性能调优', learn_type: 1, mastery: 4, exam_mode: '答辩', duration: '32h' },
  { id: 'LP06', position: '软件研发工程师', grade: 'P5', course_name: '技术债治理实战', learn_type: 2, mastery: 3, exam_mode: '问答题', duration: '12h' },
  { id: 'LP07', position: '测试工程师', grade: 'T3', course_name: '自动化测试框架', learn_type: 1, mastery: 3, exam_mode: '问答题', duration: '16h' },
  { id: 'LP08', position: '测试工程师', grade: 'T3', course_name: '测试用例设计', learn_type: 1, mastery: 2, exam_mode: '填空题', duration: '8h' },
];

// ============ API ============
export const trainingApi = {
  // 课程
  listCourses: (type?: string): Promise<CourseOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_COURSES.filter((c) => !type || c.type === type));
    return api.get('/training/courses', { type });
  },
  createCourse: (body: CourseIn): Promise<CourseOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_COURSES[0], id: `c_${Date.now()}`, ...body });
    return api.post('/training/courses', body);
  },
  updateCourse: (id: string, body: CourseUpdate): Promise<CourseOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_COURSES[0], id, ...body });
    return api.put(`/training/courses/${id}`, body);
  },
  deleteCourse: (id: string): Promise<void> => {
    if (USE_MOCK) return Promise.resolve();
    return api.delete(`/training/courses/${id}`);
  },

  // 讲师
  listInstructors: (): Promise<InstructorOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_INSTRUCTORS);
    return api.get('/training/instructors');
  },
  createInstructor: (body: InstructorIn): Promise<InstructorOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_INSTRUCTORS[0], id: `t_${Date.now()}`, ...body });
    return api.post('/training/instructors', body);
  },
  updateInstructor: (id: string, body: InstructorUpdate): Promise<InstructorOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_INSTRUCTORS[0], id, ...body });
    return api.put(`/training/instructors/${id}`, body);
  },
  deleteInstructor: (id: string): Promise<void> => {
    if (USE_MOCK) return Promise.resolve();
    return api.delete(`/training/instructors/${id}`);
  },

  // 新员工路径
  getOnboarding: (): Promise<OnboardingStage[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_ONBOARDING);
    return api.get('/training/onboarding');
  },

  // 经验萃取
  listKnowledge: (status?: string): Promise<KnowledgeOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_KNOWLEDGE.filter((k) => !status || k.status === status));
    return api.get('/training/knowledge', { status });
  },
  createKnowledge: (body: KnowledgeIn): Promise<KnowledgeOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_KNOWLEDGE[0], id: `k_${Date.now()}`, reads: 0, likes: 0, ...body });
    return api.post('/training/knowledge', body);
  },
  updateKnowledge: (id: string, body: KnowledgeUpdate): Promise<KnowledgeOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_KNOWLEDGE[0], id, ...body });
    return api.put(`/training/knowledge/${id}`, body);
  },
  deleteKnowledge: (id: string): Promise<void> => {
    if (USE_MOCK) return Promise.resolve();
    return api.delete(`/training/knowledge/${id}`);
  },
  publishKnowledge: (id: string): Promise<KnowledgeOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_KNOWLEDGE[0], id, status: 'published' });
    return api.post(`/training/knowledge/${id}/publish`);
  },

  // 学习地图
  listPaths: (position?: string, grade?: string): Promise<LearningPathOut[]> => {
    if (USE_MOCK) return Promise.resolve(MOCK_PATHS.filter((p) => (!position || p.position === position) && (!grade || p.grade === grade)));
    return api.get('/training/learning-paths', { position, grade });
  },
  createPath: (body: LearningPathIn): Promise<LearningPathOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_PATHS[0], id: `p_${Date.now()}`, ...body });
    return api.post('/training/learning-paths', body);
  },
  updatePath: (id: string, body: LearningPathUpdate): Promise<LearningPathOut> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_PATHS[0], id, ...body });
    return api.put(`/training/learning-paths/${id}`, body);
  },
  deletePath: (id: string): Promise<void> => {
    if (USE_MOCK) return Promise.resolve();
    return api.delete(`/training/learning-paths/${id}`);
  },
};

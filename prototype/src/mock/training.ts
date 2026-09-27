/**
 * 批次 8 · 培训管理与经验萃取 mock
 * 规则来源 PRD 模块二：培训管理（讲师/课程/微课/报名）、经验萃取知识库；
 * 新员工 180 天计划（入职引导→培训→带教→训练营→轮岗）。
 */

// ============ 课程与培训 ============
export interface Course {
  id: string;
  name: string;
  type: '内训' | '微课' | '训练营' | '外训';
  category: string;
  instructor: string;
  hours: number;
  enrolled: number;
  /** 完成率 */
  completion: number;
  status: '进行中' | '招生中' | '已结项';
  startedAt: string;
}

export const courses: Course[] = [
  { id: 'CR01', name: 'P4 认证知识串讲 · 分布式与工程实践', type: '训练营', category: '任职资格', instructor: '高启明', hours: 24, enrolled: 18, completion: 62, status: '进行中', startedAt: '2026-09-02' },
  { id: 'CR02', name: '新员工 180 天 · 入职引导与质量意识', type: '内训', category: '新人融入', instructor: '周敏', hours: 8, enrolled: 12, completion: 100, status: '已结项', startedAt: '2026-08-11' },
  { id: 'CR03', name: '数控加工微课系列（12 讲）', type: '微课', category: '技能提升', instructor: '钱满仓', hours: 6, enrolled: 34, completion: 71, status: '进行中', startedAt: '2026-08-20' },
  { id: 'CR04', name: '大客户销售方法论', type: '外训', category: '业务赋能', instructor: '外部讲师', hours: 16, enrolled: 8, completion: 0, status: '招生中', startedAt: '2026-10-10' },
  { id: 'CR05', name: '六西格玛绿带认证班', type: '训练营', category: '质量体系', instructor: '林晓', hours: 40, enrolled: 15, completion: 35, status: '进行中', startedAt: '2026-09-08' },
  { id: 'CR06', name: '新晋管理者 90 天转身', type: '训练营', category: '管理发展', instructor: '张澜', hours: 20, enrolled: 6, completion: 0, status: '招生中', startedAt: '2026-10-15' },
];

export interface Instructor {
  id: string;
  name: string;
  field: string;
  courses: number;
  rating: number;
  internal: boolean;
}

export const instructors: Instructor[] = [
  { id: 'T01', name: '高启明', field: '软件架构', courses: 4, rating: 4.8, internal: true },
  { id: 'T02', name: '钱满仓', field: '数控加工', courses: 6, rating: 4.9, internal: true },
  { id: 'T03', name: '林晓', field: '质量体系', courses: 3, rating: 4.7, internal: true },
  { id: 'T04', name: '张澜', field: '管理实践', courses: 2, rating: 4.6, internal: true },
];

/** 新员工 180 天路径阶段 */
export const onboardingPath = [
  { stage: '第 1–7 天 · 入职引导', items: ['企业文化与制度', '安全与保密', '导师配对'] },
  { stage: '第 8–30 天 · 基础培训', items: ['岗位基础课', '质量意识', '工具权限开通'] },
  { stage: '第 31–90 天 · 带教实操', items: ['跟岗任务', '首个独立任务', '30 天面谈'] },
  { stage: '第 91–150 天 · 训练营', items: ['序列训练营', '阶段考试', '90 天面谈'] },
  { stage: '第 151–180 天 · 轮岗/定岗', items: ['轮岗体验（可选）', '定岗评估', '转正答辩'] },
];

// ============ 经验萃取库 ============
export type ExtractStatus = 'published' | 'draft' | 'extracting';

export interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  author: string;
  /** 萃取方式：访谈萃取 / AI 自动萃取 */
  way: 'interview' | 'ai';
  status: ExtractStatus;
  reads: number;
  likes: number;
  updatedAt: string;
  summary: string;
}

export const knowledgeItems: KnowledgeItem[] = [
  { id: 'KB01', title: '高启明：核心系统性能优化 8 步法', category: '软件研发', author: '高启明', way: 'interview', status: 'published', reads: 286, likes: 42, updatedAt: '2026-08-15', summary: '从基线压测到链路拆解，沉淀一套可复用的性能优化流程与检查清单。' },
  { id: 'KB02', title: '钱满仓：薄壁件加工变形控制经验', category: '制造工艺', author: '钱满仓', way: 'interview', status: 'published', reads: 198, likes: 38, updatedAt: '2026-07-30', summary: '装夹方式、走刀路径与冷却参数的配合，老师傅三十年的实战参数表。' },
  { id: 'KB03', title: '秦朗：大客户从线索到回款的打法拆解', category: '销售实战', author: '秦朗', way: 'ai', status: 'published', reads: 342, likes: 56, updatedAt: '2026-09-01', summary: 'AI 访谈萃取：关键人地图、需求分层、竞争卡位与风险条款处理。' },
  { id: 'KB04', title: '装配一次交检合格率提升攻关纪要', category: '质量改进', author: '林晓', way: 'ai', status: 'extracting', reads: 0, likes: 0, updatedAt: '2026-09-25', summary: 'AI 正在从攻关会议纪要与数据报表中萃取问题树与对策（进行中）。' },
  { id: 'KB05', title: '新员工导师带教手册（2026 版）', category: '人才培养', author: '周敏', way: 'interview', status: 'draft', reads: 0, likes: 0, updatedAt: '2026-09-20', summary: '带教节奏、沟通模板与转正评估表，草稿待评审。' },
  { id: 'KB06', title: '董浩：工艺切换快速换模 SOP', category: '制造工艺', author: '董浩', way: 'ai', status: 'published', reads: 154, likes: 27, updatedAt: '2026-08-28', summary: '内外作业分离、模具预置与首件确认，换模时间缩短 40%。' },
];

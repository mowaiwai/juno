/** 人才梯队建设接口（模块七 P3）。 */
import { api } from './client';
import { USE_MOCK } from './config';

// ============ 类型定义 ============

export interface PipelineLevelCell {
  sequence: string;
  level_order: number;
  level_name: string;
  headcount: number;
  active_count: number;
  pool_l1: number;
  pool_l2: number;
  pool_l3: number;
  qualified: number;
  thickness: number | null;
  is_critical: boolean;
  has_gap: boolean;
}

export interface PipelinePyramidOut {
  sequence: string;
  levels: PipelineLevelCell[];
  total_headcount: number;
  total_active: number;
  total_pool: number;
}

export interface PipelineHealthOut {
  thickness: number | null;
  gap_rate: number;
  flow_rate: number;
  critical_levels: number;
  gap_levels: number;
  active_pool: number;
  recent_outflow: number;
  batch_id: string | null;
  batch_name: string | null;
  published_at: string | null;
}

export interface BackupCandidateOut {
  employee_id: string;
  name: string;
  dept_id: string;
  position: string;
  sequence: string;
  grade: string;
  level_order: number | null;
  perf_label: string;
  ability_score: number | null;
  grid_code: string | null;
  potential: string;
  pool_level: string | null;
  batch_id: string;
  batch_name: string;
}

export interface BackupCandidateListOut {
  batch_id: string | null;
  batch_name: string | null;
  items: BackupCandidateOut[];
  total: number;
}

export interface PipelineGapWarningOut {
  sequence: string;
  level_order: number;
  level_name: string;
  headcount: number;
  qualified: number;
  shortage: number;
  thickness: number | null;
  suggestion: string;
}

export interface TrainingPlanIn {
  focus?: string;
  months?: number;
}

export interface TrainingPlanOut {
  employee_id: string;
  employee_name: string;
  plan: string;
  source: 'ai_generated' | 'rule_based';
  generated_at: string;
  milestones: string[];
}

// ============ Mock 数据 ============

function _mockPyramid(sequence: string): PipelinePyramidOut {
  const levels: PipelineLevelCell[] = [
    { sequence, level_order: 1, level_name: '基础层', headcount: 20, active_count: 18, pool_l1: 3, pool_l2: 1, pool_l3: 0, qualified: 21.5, thickness: 1.08, is_critical: false, has_gap: false },
    { sequence, level_order: 2, level_name: '经验层', headcount: 15, active_count: 12, pool_l1: 2, pool_l2: 2, pool_l3: 1, qualified: 15.2, thickness: 1.01, is_critical: false, has_gap: false },
    { sequence, level_order: 3, level_name: '骨干层', headcount: 8, active_count: 5, pool_l1: 1, pool_l2: 1, pool_l3: 0, qualified: 6.5, thickness: 0.81, is_critical: true, has_gap: true },
    { sequence, level_order: 4, level_name: '精英层', headcount: 4, active_count: 2, pool_l1: 0, pool_l2: 1, pool_l3: 0, qualified: 2.5, thickness: 0.63, is_critical: true, has_gap: true },
    { sequence, level_order: 5, level_name: '事业单位经营层', headcount: 2, active_count: 1, pool_l1: 0, pool_l2: 0, pool_l3: 0, qualified: 1, thickness: 0.5, is_critical: true, has_gap: true },
  ];
  return {
    sequence,
    levels,
    total_headcount: 49,
    total_active: 38,
    total_pool: 11,
  };
}

function _mockHealth(): PipelineHealthOut {
  return {
    thickness: 0.85,
    gap_rate: 0.6,
    flow_rate: 0.12,
    critical_levels: 5,
    gap_levels: 3,
    active_pool: 18,
    recent_outflow: 2,
    batch_id: 'mock-batch-1',
    batch_name: '2026 年度盘点',
    published_at: new Date().toISOString(),
  };
}

function _mockBackupCandidates(): BackupCandidateListOut {
  return {
    batch_id: 'mock-batch-1',
    batch_name: '2026 年度盘点',
    total: 4,
    items: [
      { employee_id: 'e1', name: '林小满', dept_id: '305', position: '高级软件工程师', sequence: 'SW', grade: 'P4', level_order: 3, perf_label: 'S', ability_score: 92, grid_code: '911', potential: 'high', pool_level: 'L1', batch_id: 'mock-batch-1', batch_name: '2026 年度盘点' },
      { employee_id: 'e2', name: '陈以默', dept_id: '305', position: '软件工程师', sequence: 'SW', grade: 'P3', level_order: 2, perf_label: 'A', ability_score: 85, grid_code: '912', potential: 'high', pool_level: null, batch_id: 'mock-batch-1', batch_name: '2026 年度盘点' },
      { employee_id: 'e3', name: '苏叶', dept_id: '306', position: '机械工程师', sequence: 'ENG', grade: 'P3', level_order: 2, perf_label: 'A', ability_score: 82, grid_code: '912', potential: 'high', pool_level: 'L2', batch_id: 'mock-batch-1', batch_name: '2026 年度盘点' },
      { employee_id: 'e4', name: '沈知行', dept_id: '601', position: '大客户经理', sequence: 'SAL', grade: 'S3', level_order: 2, perf_label: 'S', ability_score: 88, grid_code: '911', potential: 'high', pool_level: null, batch_id: 'mock-batch-1', batch_name: '2026 年度盘点' },
    ],
  };
}

function _mockGapWarnings(): PipelineGapWarningOut[] {
  return [
    { sequence: 'SW', level_order: 3, level_name: '骨干层', headcount: 8, qualified: 5.5, shortage: 2.5, thickness: 0.69, suggestion: 'SW·骨干层：编制 8、合格供给 5.5（厚度 69%），缺 2.5。建议：1) 从盘点高潜池补位 L1/L2；2) 启动继任盘点；3) 外部招聘补缺口。' },
    { sequence: 'SW', level_order: 4, level_name: '精英层', headcount: 4, qualified: 2.0, shortage: 2.0, thickness: 0.5, suggestion: 'SW·精英层：编制 4、合格供给 2.0（厚度 50%），缺 2.0。建议：1) 从盘点高潜池补位 L1/L2；2) 启动继任盘点；3) 外部招聘补缺口。' },
    { sequence: 'MGT', level_order: 5, level_name: '事业单位经营层', headcount: 2, qualified: 1.0, shortage: 1.0, thickness: 0.5, suggestion: 'MGT·事业单位经营层：编制 2、合格供给 1.0（厚度 50%），缺 1.0。建议：1) 从盘点高潜池补位 L1/L2；2) 启动继任盘点；3) 外部招聘补缺口。' },
  ];
}

// ============ API ============

export const talentPipelineApi = {
  pyramid: (sequence: string): Promise<PipelinePyramidOut> => {
    if (USE_MOCK) return Promise.resolve(_mockPyramid(sequence));
    return api.get<PipelinePyramidOut>('/talent-pipeline/pyramid', { sequence });
  },

  health: (): Promise<PipelineHealthOut> => {
    if (USE_MOCK) return Promise.resolve(_mockHealth());
    return api.get<PipelineHealthOut>('/talent-pipeline/health');
  },

  backupCandidates: (): Promise<BackupCandidateListOut> => {
    if (USE_MOCK) return Promise.resolve(_mockBackupCandidates());
    return api.get<BackupCandidateListOut>('/talent-pipeline/backup-candidates');
  },

  gapWarnings: (): Promise<PipelineGapWarningOut[]> => {
    if (USE_MOCK) return Promise.resolve(_mockGapWarnings());
    return api.get<PipelineGapWarningOut[]>('/talent-pipeline/gap-warnings');
  },

  trainingPlan: (employeeId: string, body: TrainingPlanIn): Promise<TrainingPlanOut> => {
    if (USE_MOCK) {
      return Promise.resolve({
        employee_id: employeeId,
        employee_name: '林小满',
        plan: `后备培养 6 个月计划（规则模板）：第 1-2 月完成 SW 序列下一层级任职资格认证；第 2-4 月轮岗至关键岗位副手；第 4-6 月主导跨部门项目。`,
        source: 'rule_based',
        generated_at: new Date().toISOString(),
        milestones: [
          'M1-M2：完成 SW 序列高一阶任职资格认证',
          'M2-M4：关键岗位副手轮岗，输出岗位胜任力报告',
          'M4-M6：主导 1 个跨部门项目，沉淀 SOP',
        ],
      });
    }
    return api.post<TrainingPlanOut>(`/talent-pipeline/training-plan/${employeeId}`, body);
  },
};

import { api } from './client';

export type ApplicationStatusValue =
  | 'draft'
  | 'submitted'
  | 'in_manager_review'
  | 'in_committee_review'
  | 'approved'
  | 'rejected'
  | 'published';

export type SelfLevelValue = 'met' | 'partially_met' | 'not_met';

export interface StandardItemBriefDTO {
  code: string;
  name: string;
  description: string;
  requirement: string;
  weight: number;
  sort_order: number;
}

export interface SelfAssessmentDTO {
  standard_item_code: string;
  self_level: SelfLevelValue;
  self_comment: string | null;
}

export interface EvidenceDTO {
  id: string;
  standard_item_code: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface ManagerReviewDTO {
  decision: string;
  reject_category: string | null;
  comment: string | null;
}

export interface ApplicationDetailDTO {
  id: string;
  tenant_id: string;
  employee_id: string;
  target_sequence: string;
  target_grade: string;
  standard_set_id: string;
  status: ApplicationStatusValue;
  previous_application_id: string | null;
  submitted_at: string | null;
  standard_items: StandardItemBriefDTO[];
  self_assessments: SelfAssessmentDTO[];
  evidences: EvidenceDTO[];
  manager_review: ManagerReviewDTO | null;
  final_decision: string | null;
}

export interface ApplicationListItemDTO {
  id: string;
  target_sequence: string;
  target_grade: string;
  status: ApplicationStatusValue;
  submitted_at: string | null;
  decided_at: string | null;
  published_at: string | null;
  employee_name: string | null;
}

/** 状态展示元数据（Steps 索引 + 中文标签 + 主题色） */
export const APPLICATION_STATUS_META: Record<
  ApplicationStatusValue,
  { label: string; step: number; color: string; bg: string }
> = {
  draft: { label: '草稿', step: 0, color: 'var(--ink-3)', bg: 'var(--surface-sunken)' },
  submitted: { label: '已提交', step: 1, color: 'var(--ochre)', bg: 'var(--ochre-soft)' },
  in_manager_review: { label: '经理初审中', step: 2, color: 'var(--ochre)', bg: 'var(--ochre-soft)' },
  in_committee_review: { label: '评审委员会评审中', step: 3, color: 'var(--clay)', bg: 'var(--clay-soft)' },
  approved: { label: '终审通过 · 待发布', step: 4, color: 'var(--sage)', bg: 'var(--sage-soft)' },
  rejected: { label: '已驳回', step: 2, color: 'var(--danger)', bg: 'var(--danger-soft)' },
  published: { label: '已发布', step: 5, color: 'var(--sage)', bg: 'var(--sage-soft)' },
};

export const SELF_LEVEL_META: Record<SelfLevelValue, { label: string; color: string }> = {
  met: { label: '达到', color: 'var(--sage)' },
  partially_met: { label: '部分达到', color: 'var(--ochre)' },
  not_met: { label: '未达到', color: 'var(--danger)' },
};

export const applicationsApi = {
  mine: () => api.get<ApplicationListItemDTO[]>('/applications/mine'),
  get: (id: string) => api.get<ApplicationDetailDTO>(`/applications/${id}`),
  create: (target_sequence: string, target_grade: string) =>
    api.post<ApplicationDetailDTO>('/applications', {
      target_sequence,
      target_grade,
    }),
  saveAssessments: (
    id: string,
    items: Array<{
      standard_item_code: string;
      self_level: SelfLevelValue;
      self_comment?: string | null;
    }>,
  ) =>
    api.put<ApplicationDetailDTO>(`/applications/${id}/self-assessment`, {
      items,
    }),
  uploadEvidence: (id: string, standard_item_code: string, file: File) => {
    const form = new FormData();
    form.append('standard_item_code', standard_item_code);
    form.append('file', file);
    return api.upload<EvidenceDTO>(`/applications/${id}/evidences`, form);
  },
  deleteEvidence: (evidenceId: string) =>
    api.delete<void>(`/evidences/${evidenceId}`),
  submit: (id: string) =>
    api.post<ApplicationListItemDTO>(`/applications/${id}/submit`),
  withdraw: (id: string) =>
    api.post<ApplicationListItemDTO>(`/applications/${id}/withdraw`),
  resubmit: (id: string) =>
    api.post<ApplicationDetailDTO>(`/applications/${id}/resubmit`),
};

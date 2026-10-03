import { api } from './client';
import type { ApplicationListItemDTO } from './applications';

export type RejectCategoryValue =
  | 'evidence_insufficient'
  | 'self_assessment_mismatch'
  | 'ability_gap'
  | 'tenure_not_ready'
  | 'other';

export const REJECT_CATEGORY_OPTIONS: Array<{
  label: string;
  value: RejectCategoryValue;
}> = [
  { label: '举证不足', value: 'evidence_insufficient' },
  { label: '自评与实际明显不符', value: 'self_assessment_mismatch' },
  { label: '能力差距较大', value: 'ability_gap' },
  { label: '历练不足', value: 'tenure_not_ready' },
  { label: '其他', value: 'other' },
];

export const managerApi = {
  list: (status: string = 'submitted') =>
    api.get<ApplicationListItemDTO[]>('/manager/applications', { status }),
  approve: (applicationId: string) =>
    api.post<ApplicationListItemDTO>(
      `/applications/${applicationId}/manager-review`,
      { decision: 'approved' },
    ),
  reject: (
    applicationId: string,
    reject_category: RejectCategoryValue,
    comment: string,
  ) =>
    api.post<ApplicationListItemDTO>(
      `/applications/${applicationId}/manager-review`,
      { decision: 'rejected', reject_category, comment },
    ),
};

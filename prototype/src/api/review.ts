import { api } from './client';
import type { ApplicationListItemDTO } from './applications';

export type PanelRoleValue = 'lead' | 'reviewer';

export interface ReviewTaskDTO {
  id: string;
  application_id: string;
  assignee_id: string;
  role: PanelRoleValue;
  opinion: string | null;
  submitted_at: string | null;
  locked_by: string | null;
  locked_until: string | null;
}

export const reviewApi = {
  tasks: () => api.get<ReviewTaskDTO[]>('/review/tasks'),
  claim: (taskId: string) =>
    api.post<ReviewTaskDTO>(`/review/tasks/${taskId}/claim`),
  release: (taskId: string) =>
    api.post<void>(`/review/tasks/${taskId}/release`),
  submitOpinion: (taskId: string, opinion: string) =>
    api.post<ReviewTaskDTO>(`/review/tasks/${taskId}/opinion`, { opinion }),
};

export interface DecisionResult extends ApplicationListItemDTO {}

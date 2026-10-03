import { api } from './client';
import type { ApplicationListItemDTO } from './applications';

export const hrApplicationsApi = {
  list: (status?: string) =>
    api.get<ApplicationListItemDTO[]>('/applications', status ? { status } : {}),
  publish: (applicationId: string) =>
    api.post<ApplicationListItemDTO>(
      `/applications/${applicationId}/publish`,
    ),
};

export const leadApi = {
  decide: (
    applicationId: string,
    body: {
      decision: 'approved' | 'rejected';
      comment: string;
      interview_notes?: string | null;
    },
  ) =>
    api.post<ApplicationListItemDTO>(
      `/applications/${applicationId}/decision`,
      body,
    ),
};

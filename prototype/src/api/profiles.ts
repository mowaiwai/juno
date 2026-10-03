/** 七维人才画像接口（spec talent-matching §5.1）。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { latestProfile, profileVersions } from '@/mock/profiles';

export interface DimensionOut {
  dimension_key: string;
  status: string;
  score: number | null;
  grade_label: string | null;
  note: string | null;
}

export interface ProfileOut {
  id: string;
  tenant_id: string;
  employee_id: string;
  version_seq: number;
  source: string;
  overall: number | null;
  generated_by: string | null;
  generated_at: string;
  dimensions: DimensionOut[];
}

export interface ProfileVersionItem {
  version_seq: number;
  source: string;
  overall: number | null;
  generated_at: string;
}

const DIM_KEYS = ['basic', 'biz', 'contribution', 'duty', 'knowledge', 'ability', 'perf'];

function mockSnapshotToDTO(empId: string, seq = 1): ProfileOut {
  const s = latestProfile(empId);
  return {
    id: `${empId}-v${seq}`,
    tenant_id: 'mock',
    employee_id: empId,
    version_seq: seq,
    source: s.source,
    overall: s.overall,
    generated_by: null,
    generated_at: s.generatedAt,
    dimensions: DIM_KEYS.map((k) => {
      const d = s.dims[k];
      return {
        dimension_key: k,
        status: d ? 'measured' : 'unmeasured',
        score: d?.score ?? null,
        grade_label: d?.grade ?? null,
        note: d?.note ?? null,
      };
    }),
  };
}

export const profilesApi = {
  latest: (employeeId: string) => {
    if (USE_MOCK) return Promise.resolve(mockSnapshotToDTO(employeeId));
    return api.get<ProfileOut>(`/profiles/${employeeId}/latest`);
  },
  versions: (employeeId: string) => {
    if (USE_MOCK) {
      const list = profileVersions(employeeId);
      return Promise.resolve(
        list.map((v, i) => ({
          version_seq: i + 1,
          source: v.source,
          overall: v.overall,
          generated_at: v.generatedAt,
        })),
      );
    }
    return api.get<ProfileVersionItem[]>(`/profiles/${employeeId}/versions`);
  },
  versionDetail: (employeeId: string, versionSeq: number) => {
    if (USE_MOCK) return Promise.resolve(mockSnapshotToDTO(employeeId, versionSeq));
    return api.get<ProfileOut>(`/profiles/${employeeId}/versions/${versionSeq}`);
  },
  generate: (employeeId?: string, scope?: string) => {
    if (USE_MOCK) return Promise.resolve(mockSnapshotToDTO(employeeId ?? 'mock'));
    return api.post<ProfileOut>('/profiles/generate', { employee_id: employeeId, scope });
  },
  regenerateMe: () => {
    if (USE_MOCK) return Promise.resolve(mockSnapshotToDTO('mock'));
    return api.post<ProfileOut>('/profiles/me/regenerate');
  },
};

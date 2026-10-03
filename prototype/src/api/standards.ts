import { api } from './client';

export interface StandardItemDTO {
  id: string;
  code: string;
  name: string;
  description: string;
  requirement: string;
  weight: number;
  sort_order: number;
}

export interface StandardSetDTO {
  id: string;
  tenant_id: string;
  sequence: string;
  target_grade: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  items: StandardItemDTO[];
}

// 模块级缓存：同参列表去重（切换筛选后 invalidate 由页面自行重取）
const listCache = new Map<string, Promise<StandardSetDTO[]>>();

function listSets(params?: {
  sequence?: string;
  target_grade?: string;
  status?: string;
}): Promise<StandardSetDTO[]> {
  const key = JSON.stringify(params ?? {});
  let p = listCache.get(key);
  if (!p) {
    p = api.get<StandardSetDTO[]>('/standard-sets', params ?? {});
    listCache.set(key, p);
    p.catch(() => listCache.delete(key));
  }
  return p;
}

export const standardsApi = {
  list: listSets,
  get: (id: string) => api.get<StandardSetDTO>(`/standard-sets/${id}`),
  /** HR 发布草稿：权重合计须为 100；成功后清列表缓存 */
  publish: async (id: string) => {
    const r = await api.post<StandardSetDTO>(`/standard-sets/${id}/publish`);
    listCache.clear();
    return r;
  },
};

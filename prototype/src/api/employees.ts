/** 员工目录接口（HR 可见）。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { employees as mockEmployees } from '@/mock/people';

export interface EmployeeDirectoryItem {
  id: string;
  employee_no: string;
  name: string;
  dept_id: string;
  position: string;
  family: string;
  sequence: string;
  grade: string;
  grade_since: string | null;
  perf_grade: string | null;
  manager_id: string | null;
  manager_name: string | null;
  is_active: boolean;
}

export interface EmployeeDetailItem extends EmployeeDirectoryItem {
  education: string | null;
  certificates: string[];
}

/** 模块级缓存：多个页面共享同一份员工目录，避免重复请求 */
let _cache: Promise<EmployeeDirectoryItem[]> | null = null;

export const employeesApi = {
  list: (deptId?: string) => {
    if (USE_MOCK) {
      return Promise.resolve(
        mockEmployees.map((e) => ({
          id: e.id,
          employee_no: e.id,
          name: e.name,
          dept_id: e.deptId,
          position: e.position,
          family: e.family,
          sequence: e.sequence,
          grade: e.grade,
          grade_since: null,
          perf_grade: e.perf,
          manager_id: null,
          manager_name: null,
          is_active: true,
        })),
      );
    }
    if (!_cache) {
      _cache = api.get<EmployeeDirectoryItem[]>('/employees', deptId ? { dept_id: deptId } : undefined);
    }
    return _cache;
  },
  getById: (id: string) => {
    if (USE_MOCK) {
      const e = mockEmployees.find((m) => m.id === id);
      return Promise.resolve(
        e
          ? {
              id: e.id,
              employee_no: e.id,
              name: e.name,
              dept_id: e.deptId,
              position: e.position,
              family: e.family,
              sequence: e.sequence,
              grade: e.grade,
              grade_since: null,
              perf_grade: e.perf,
              manager_id: null,
              manager_name: null,
              is_active: true,
              education: null,
              certificates: [],
            }
          : null,
      );
    }
    return api.get<EmployeeDetailItem>(`/employees/${id}`);
  },
  /** 刷新缓存（人员变动后调用） */
  invalidate: () => { _cache = null; },
};

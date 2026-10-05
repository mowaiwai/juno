/** 薪酬激励模块接口（P2）：规则、调薪方案、奖金方案、我的薪酬。 */
import { API_BASE_URL } from './config';
import { api, ApiError, getToken, getActiveRoleHeader } from './client';

/** 市场分位停涨键（现薪 ≥ 对应分位薪点时停涨） */
export type MarketStopKey = 'p25' | 'p50' | 'p75' | 'p90';

export interface CompRules {
  adjust_matrix: Record<string, number[]>;
  penetration_bands: number[];
  market_stop: MarketStopKey;
  pay_mix: Record<string, number>;
  pip_fail_adjust_pct: number;
}

export interface AdjustmentItem {
  employee_id: string;
  current_salary: number;
  suggested_pct: number;
  suggested_salary: number;
  mark?: string | null;
  // 快照字段
  name?: string;
  employee_no?: string;
  grade?: string;
  sequence?: string;
  dept_id?: string;
  perf_grade?: string;
  penetration?: number;
  delta?: number;
}

/** 测算预览返回行（service 原始字段名） */
export interface AdjustmentPreviewItem {
  employee_id: string;
  name: string;
  employee_no: string;
  grade: string;
  sequence: string;
  dept_id: string | null;
  base_salary: number;
  perf_grade: string;
  penetration: number;
  adjust_pct: number;
  new_salary: number;
  delta: number;
  mark: string | null;
}

export interface AdjustmentPreview {
  items: AdjustmentPreviewItem[];
  budget_total: number;
  headcount: number;
}

export interface AdjustmentPlanSummary {
  id: string;
  plan_name: string;
  status: string;
  headcount: number;
  budget_total: number;
  reject_reason?: string | null;
  approved_at?: string | null;
}

export interface AdjustmentPlan {
  id: string;
  plan_name: string;
  status: string;
  items: AdjustmentItem[];
  adjustments: Array<{
    employee_id: string;
    old_pct: number;
    new_pct: number;
    operator_id: string;
    at: string;
  }>;
  budget_total?: number;
  reject_reason?: string | null;
  approved_at?: string | null;
}

export interface BonusPlanItem {
  employee_id: string;
  name?: string;
  employee_no?: string;
  grade?: string;
  dept_id?: string | null;
  target_bonus: number | null;
  formula_amount: number | null;
  final_amount: number | null;
  perf_coefficient?: number | null;
  org_coefficient?: number | null;
  service_months?: number | null;
  scale_ratio: number;
  excluded_reason?: string | null;
}

export interface DeptPool {
  dept_id: string;
  target_sum: number;
  formula_sum: number;
  pool_amount: number;
  adjust_reason?: string | null;
}

export interface BonusPlan {
  id: string;
  plan_name: string;
  status: string;
  bonus_pool_total: number;
  proration_enabled: boolean;
  items: BonusPlanItem[];
  dept_pools: DeptPool[];
  reject_reason?: string | null;
  approved_at?: string | null;
}

/** 列表接口只返回摘要，不含明细/部门包 */
export interface BonusPlanSummary {
  id: string;
  plan_name: string;
  status: string;
  bonus_pool_total: number;
}

export interface MySalary {
  base_salary: number | null;
  name: string;
  employee_no: string;
  grade: string;
  approved_bonuses: Array<{
    plan_id: string;
    plan_name: string;
    period: string | null;
    tool_type: string | null;
    perf_grade: string | null;
    final_amount: number;
    formula_amount: number;
    target_bonus: number;
  }>;
}

export const compApi = {
  rules: () => api.get<CompRules>('/comp/rules'),
  updateRules: (patch: Partial<CompRules>) => api.put<CompRules>('/comp/rules', patch),

  // 调薪方案
  previewAdjustments: (scope_depts: string[]) =>
    api.post<AdjustmentPreview>('/comp/adjustment-plans/preview', { scope_depts }),
  createAdjustmentPlan: (body: {
    plan_name: string;
    scope_depts: string[];
    items: Array<{
      employee_id: string;
      current_salary: number;
      suggested_pct: number;
      suggested_salary: number;
      mark?: string | null;
      name?: string;
      employee_no?: string;
      grade?: string;
      sequence?: string;
      dept_id?: string | null;
      perf_grade?: string;
      penetration?: number;
      delta?: number;
    }>;
  }) => api.post<AdjustmentPlan>('/comp/adjustment-plans', body),
  listAdjustmentPlans: () => api.get<AdjustmentPlanSummary[]>('/comp/adjustment-plans'),
  getAdjustmentPlan: (id: string) => api.get<AdjustmentPlan>(`/comp/adjustment-plans/${id}`),
  tuneAdjustment: (id: string, employee_id: string, new_pct: number) =>
    api.patch<{ items: AdjustmentItem[]; adjustments: AdjustmentPlan['adjustments']; status: string }>(`/comp/adjustment-plans/${id}`, { employee_id, new_pct }),
  submitAdjustment: (id: string) =>
    api.post(`/comp/adjustment-plans/${id}/submit`),
  approveAdjustment: (id: string) =>
    api.post(`/comp/adjustment-plans/${id}/approve`),
  rejectAdjustment: (id: string, reason: string) =>
    api.post(`/comp/adjustment-plans/${id}/reject`, { reason }),

  // 奖金方案
  createBonusPlan: (body: {
    perf_plan_id: string;
    plan_name: string;
    scope_depts: string[];
    proration_enabled: boolean;
    /** 奖金包总额（0 或缺省 = 不预切，按公式 1:1） */
    bonus_pool_total?: number;
  }) => api.post<{ id: string }>('/comp/bonus-plans', body),
  listBonusPlans: () => api.get<BonusPlanSummary[]>('/comp/bonus-plans'),
  calculateBonus: (id: string) =>
    api.post<{ id: string; status: string; headcount: number; excluded: number }>(
      `/comp/bonus-plans/${id}/calculate`,
    ),
  getBonusPlan: (id: string) => api.get<BonusPlan>(`/comp/bonus-plans/${id}`),
  tuneDeptPool: (planId: string, deptId: string, pool_amount: number, adjust_reason: string) =>
    api.patch(`/comp/bonus-plans/${planId}/dept-pools/${deptId}`, { pool_amount, adjust_reason }),
  /** 个人目标奖金覆盖（留痕），按原系数/折算重算公式 */
  tuneBonusItem: (planId: string, employeeId: string, target_bonus: number, reason: string) =>
    api.patch<{ employee_id: string; target_bonus: number; formula_amount: number }>(
      `/comp/bonus-plans/${planId}/items/${employeeId}`,
      { target_bonus, reason },
    ),
  /** 导出发放清单 CSV（需带 token，fetch 后触发浏览器下载） */
  async downloadBonusPayout(planId: string): Promise<void> {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const role = getActiveRoleHeader();
    if (role) headers['X-Active-Role'] = role;
    const resp = await fetch(`${API_BASE_URL}/comp/bonus-plans/${planId}/payout-export`, { headers });
    if (!resp.ok) {
      let code = 'error';
      let message = resp.statusText;
      try {
        const obj = await resp.json();
        code = obj.code ?? code;
        message = obj.message ?? message;
      } catch { /* 非 JSON 错误体 */ }
      throw new ApiError(resp.status, code, message);
    }
    const blob = await resp.blob();
    const disposition = resp.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `payout-${planId}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  submitBonus: (id: string) => api.post(`/comp/bonus-plans/${id}/submit`),
  approveBonus: (id: string) => api.post(`/comp/bonus-plans/${id}/approve`),
  rejectBonus: (id: string, reason: string) =>
    api.post(`/comp/bonus-plans/${id}/reject`, { reason }),

  // 我的薪酬
  mySalary: () => api.get<MySalary>('/comp/my-salary'),
};

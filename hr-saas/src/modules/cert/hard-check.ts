/**
 * Ticket 03 seam: hard-check rules (基本条件 + 业绩条件).
 * Rule parameters come from qc_standard.basic_condition / perf_condition (JSON),
 * thresholds configurable via tenant_config where noted (ADR-0006).
 */

export const EDUCATION_RANK: Record<string, number> = { 高中: 1, 大专: 2, 本科: 3, 硕士: 4, 博士: 5 };
export const GRADE_RANK: Record<string, number> = { D: 0, C: 1, B: 2, A: 3, S: 4 };

export interface BasicCondition {
  education?: string; // minimum education
  work_years?: number; // minimum tenure in years
}
export interface PerfCondition {
  recent_two_year_min_a?: number; // count of A/S in the two years before applyYear
  recent_year_min?: string; // minimum grade in the year before applyYear
}
export interface PerfRecordLite {
  period: string; // e.g. 2024 | 2024-H1 | 2024-Q3
  grade: string;
}
export interface EmployeeLite {
  education: string;
  hire_date: Date | null;
}

export interface HardCheckResult {
  pass: boolean;
  reasons: string[]; // failure reasons, human-readable
}

const yearOf = (period: string) => Number(period.slice(0, 4));

/** Tenure in whole years between hire_date and the start of applyYear (deterministic). */
export function tenureYears(hireDate: Date | null, applyYear: number): number {
  if (!hireDate) return 0;
  return (new Date(applyYear, 0, 1).getTime() - hireDate.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export function hardCheck(
  basic: BasicCondition,
  perf: PerfCondition,
  employee: EmployeeLite,
  perfRecords: PerfRecordLite[],
  applyYear: number,
): HardCheckResult {
  const reasons: string[] = [];

  if (basic.education) {
    const need = EDUCATION_RANK[basic.education] ?? 0;
    const have = EDUCATION_RANK[employee.education] ?? 0;
    if (have < need) reasons.push(`学历不达标: 要求${basic.education}, 实际${employee.education || '未知'}`);
  }
  if (basic.work_years != null) {
    const years = tenureYears(employee.hire_date, applyYear);
    if (years < basic.work_years) reasons.push(`工龄不达标: 要求${basic.work_years}年, 实际${years.toFixed(1)}年`);
  }

  if (perf.recent_two_year_min_a != null) {
    const years = new Set([applyYear - 1, applyYear - 2]);
    const count = perfRecords.filter((r) => years.has(yearOf(r.period)) && GRADE_RANK[r.grade] >= GRADE_RANK.A).length;
    if (count < perf.recent_two_year_min_a) {
      reasons.push(`业绩条件不达标: 近两年A及以上需${perf.recent_two_year_min_a}次, 实际${count}次`);
    }
  }
  if (perf.recent_year_min) {
    const y = applyYear - 1;
    const records = perfRecords.filter((r) => yearOf(r.period) === y);
    const best = records.reduce((m, r) => Math.max(m, GRADE_RANK[r.grade] ?? -1), -1);
    const need = GRADE_RANK[perf.recent_year_min] ?? 0;
    if (best < need) {
      reasons.push(`业绩条件不达标: 近一年(${y})需${perf.recent_year_min}及以上, 实际${best < 0 ? '无记录' : [...Object.entries(GRADE_RANK)].find(([, v]) => v === best)?.[0]}`);
    }
  }
  return { pass: reasons.length === 0, reasons };
}

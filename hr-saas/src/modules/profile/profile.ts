/**
 * Profile engine seam (ADR-0005): build a 7-dimension snapshot from raw data.
 * Potential dimension is intentionally empty in MVP (no assessment survey).
 */

export interface DimBasic { education: string; hire_date: string | null; current_grade: string; }
export interface DimPerformance { periods: Array<{ period: string; grade: string }>; }
export interface DimTeamContrib { role: string; projects: string[]; }
export interface DimDuty { cert_status: string; duties: string[]; }
export interface DimKnowledge { exam_passed: boolean; mastery_summary: string[]; }
export interface DimAbility { abilities: string[]; }
export interface DimPerfSummary { latest_period: string; latest_grade: string; }
export interface DimPotential { note: string; }

export interface DimensionData {
  basic: DimBasic;
  performance: DimPerformance;
  team_contrib: DimTeamContrib;
  duty: DimDuty;
  knowledge: DimKnowledge;
  ability: DimAbility;
  perf_summary: DimPerfSummary;
  potential: DimPotential;
}

export function buildDimensionData(
  emp: { education: string; hire_date: Date | null; grade: string },
  perfs: Array<{ period: string; grade: string }>,
  examRecord?: { passed: number | null } | null,
  cert?: { status: string } | null,
  duties?: string[],
  abilities?: string[],
): DimensionData {
  const sorted = [...perfs].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1];
  return {
    basic: {
      education: emp.education,
      hire_date: emp.hire_date ? emp.hire_date.toISOString().slice(0, 10) : null,
      current_grade: emp.grade,
    },
    performance: { periods: sorted },
    team_contrib: { role: '成员', projects: [] },
    duty: {
      cert_status: cert?.status ?? '',
      duties: duties ?? [],
    },
    knowledge: {
      exam_passed: examRecord ? examRecord.passed === 1 : false,
      mastery_summary: [],
    },
    ability: {
      abilities: abilities ?? [],
    },
    perf_summary: {
      latest_period: latest?.period ?? '',
      latest_grade: latest?.grade ?? '',
    },
    potential: { note: '' },
  };
}

/** Role mask rules: EMPLOYEE own only; MANAGER own + direct reports; HR/EXEC all. */
export function canViewProfile(viewerRole: string, viewerId: string, targetId: string, isDirectReport: boolean): boolean {
  if (viewerRole === 'EXEC' || viewerRole === 'HR') return true;
  if (viewerRole === 'MANAGER') return viewerId === targetId || isDirectReport;
  return viewerId === targetId;
}

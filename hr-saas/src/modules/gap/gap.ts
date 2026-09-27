/**
 * Gap analysis seam (ADR-0004): deterministic rules, no LLM.
 * Five gap types: PERFORMANCE | DUTY | ABILITY | TEAM_CONTRIB | KNOWLEDGE
 */

export type GapType = 'PERFORMANCE' | 'DUTY' | 'ABILITY' | 'TEAM_CONTRIB' | 'KNOWLEDGE';

export const ACTION_ROUTING: Record<GapType, string> = {
  PERFORMANCE: '绩效改进',
  DUTY: '过程监督',
  ABILITY: '行为改善',
  TEAM_CONTRIB: '团队任务',
  KNOWLEDGE: '学习',
};

export function routeAction(gapType: GapType): string {
  return ACTION_ROUTING[gapType];
}

export interface GapCandidate {
  gap_type: GapType;
  gap_detail: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export function analyzeGaps(
  standard: {
    perf_condition: Record<string, any>;
    duties: Array<{ duty_item: string; duty_level: number }>;
    abilities: Array<{ ability_item: string }>;
    knowledge: Array<{ knowledge_point: string; mastery_level: number }>;
  },
  profile: {
    perf_summary: { latest_grade: string };
    duty: { cert_status: string };
    knowledge: { exam_passed: boolean };
    ability: { abilities: string[] };
    team_contrib: { role: string };
  },
): GapCandidate[] {
  const gaps: GapCandidate[] = [];

  // 1. PERFORMANCE: latest grade below B?
  const gradeRank: Record<string, number> = { D: 0, C: 1, B: 2, A: 3, S: 4 };
  const latest = gradeRank[profile.perf_summary.latest_grade] ?? -1;
  if (latest >= 0 && latest < gradeRank.B) {
    gaps.push({ gap_type: 'PERFORMANCE', gap_detail: `最近绩效为 ${profile.perf_summary.latest_grade}，低于 B`, severity: 'HIGH' });
  }

  // 2. DUTY: no effective cert?
  if (profile.duty.cert_status !== 'EFFECTIVE') {
    gaps.push({ gap_type: 'DUTY', gap_detail: '未完成任职资格认证', severity: 'MEDIUM' });
  }

  // 3. KNOWLEDGE: exam not passed?
  if (!profile.knowledge.exam_passed) {
    gaps.push({ gap_type: 'KNOWLEDGE', gap_detail: '认证考试未通过', severity: 'MEDIUM' });
  }

  // 4. ABILITY: standard abilities not yet demonstrated (simplified: no abilities listed)
  if (profile.ability.abilities.length === 0) {
    gaps.push({ gap_type: 'ABILITY', gap_detail: '能力素质项未举证', severity: 'LOW' });
  }

  // 5. TEAM_CONTRIB: no team contribution record
  if (!profile.team_contrib.role || profile.team_contrib.role === '成员') {
    gaps.push({ gap_type: 'TEAM_CONTRIB', gap_detail: '团队贡献角色未明确', severity: 'LOW' });
  }

  return gaps;
}

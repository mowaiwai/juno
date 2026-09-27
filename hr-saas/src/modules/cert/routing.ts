/**
 * Ticket 03 seam: 认证路由 (ADR-0006 configurable, defaults = PRD values).
 * P1->P2: 部门经理单审 (MANAGER_SINGLE)
 * P2->P3: 认证小组 3-5 人表决 (PANEL_VOTE)
 * P3+ : 管委会终审 (COMMITTEE_FINAL)
 */

export type ReviewRoute = 'MANAGER_SINGLE' | 'PANEL_VOTE' | 'COMMITTEE_FINAL';

export interface PanelVote {
  voter_id: string;
  approve: boolean;
}

/** Panel vote passes when approve ratio >= passRatio (default 0.5). */
export function panelVotePassed(votes: PanelVote[], passRatio: number): boolean {
  if (votes.length === 0) return false;
  const approve = votes.filter((v) => v.approve).length;
  return approve / votes.length >= passRatio;
}

/** Resolve route for a target grade using config keys cert.route.pN. */
export function routeForTargetGrade(targetGrade: string, config: (key: string) => string): ReviewRoute {
  const key = `cert.route.${targetGrade.toLowerCase()}`;
  const v = config(key);
  if (v === 'MANAGER_SINGLE' || v === 'PANEL_VOTE' || v === 'COMMITTEE_FINAL') return v;
  throw new Error(`unknown review route for ${targetGrade}: ${v}`);
}

/**
 * Ticket 03: certification state machine (ADR-0004 状态机承载确定性).
 * Pure transition function — illegal transitions throw, engine intercepts.
 *
 * Main chain: INITIATED -> MATERIAL_REVIEW -> EXAM -> DEFENSE_REVIEW -> EFFECTIVE
 * Exceptions (spec.md 认证状态机):
 *  - hard check fail        -> TERMINATED_UNQUALIFIED
 *  - material rejected      -> MATERIAL_RETURNED (resubmit, max from config)
 *  - exam fail              -> EXAM (retake, max from config) -> TERMINATED_EXAM_FAILED
 *  - defense fail           -> TERMINATED_DEFENSE_FAILED (with improvement advice)
 *  - batch timeout          -> CLOSED_TIMEOUT
 *  - employee withdraw      -> WITHDRAWN (not allowed once DEFENSE_REVIEW started)
 */

export type CertStatus =
  | 'INITIATED'
  | 'MATERIAL_REVIEW'
  | 'MATERIAL_RETURNED'
  | 'EXAM'
  | 'DEFENSE_REVIEW'
  | 'EFFECTIVE'
  | 'TERMINATED_UNQUALIFIED'
  | 'TERMINATED_EXAM_FAILED'
  | 'TERMINATED_DEFENSE_FAILED'
  | 'CLOSED_TIMEOUT'
  | 'WITHDRAWN';

export type CertEvent =
  | 'hard_check_pass'
  | 'hard_check_fail'
  | 'material_approve'
  | 'material_reject'
  | 'material_resubmit'
  | 'exam_pass'
  | 'exam_fail'
  | 'defense_pass'
  | 'defense_fail'
  | 'withdraw'
  | 'timeout';

export const TERMINAL_STATES: ReadonlySet<CertStatus> = new Set([
  'EFFECTIVE',
  'TERMINATED_UNQUALIFIED',
  'TERMINATED_EXAM_FAILED',
  'TERMINATED_DEFENSE_FAILED',
  'CLOSED_TIMEOUT',
  'WITHDRAWN',
]);

export interface TransitionCtx {
  retakeCount: number;
  maxRetake: number;
  resubmitCount: number;
  maxResubmit: number;
}

export class IllegalTransition extends Error {
  constructor(from: CertStatus, event: CertEvent) {
    super(`非法状态迁移: ${from} + ${event}`);
    this.name = 'IllegalTransition';
  }
}

/** Events that exhaust a retry budget produce a different next state. */
export function transition(from: CertStatus, event: CertEvent, ctx: TransitionCtx): CertStatus {
  if (TERMINAL_STATES.has(from)) throw new IllegalTransition(from, event);

  switch (event) {
    case 'hard_check_pass':
      if (from === 'INITIATED') return 'MATERIAL_REVIEW';
      break;
    case 'hard_check_fail':
      if (from === 'INITIATED') return 'TERMINATED_UNQUALIFIED';
      break;
    case 'material_approve':
      if (from === 'MATERIAL_REVIEW') return 'EXAM';
      break;
    case 'material_reject':
      if (from === 'MATERIAL_REVIEW') return 'MATERIAL_RETURNED';
      break;
    case 'material_resubmit':
      if (from === 'MATERIAL_RETURNED') {
        if (ctx.resubmitCount >= ctx.maxResubmit) throw new IllegalTransition(from, event);
        return 'MATERIAL_REVIEW';
      }
      break;
    case 'exam_pass':
      if (from === 'EXAM') return 'DEFENSE_REVIEW';
      break;
    case 'exam_fail':
      if (from === 'EXAM') {
        return ctx.retakeCount < ctx.maxRetake ? 'EXAM' : 'TERMINATED_EXAM_FAILED';
      }
      break;
    case 'defense_pass':
      if (from === 'DEFENSE_REVIEW') return 'EFFECTIVE';
      break;
    case 'defense_fail':
      if (from === 'DEFENSE_REVIEW') return 'TERMINATED_DEFENSE_FAILED';
      break;
    case 'withdraw':
      // 评审开始后不可撤 (PRD): withdraw blocked from DEFENSE_REVIEW onward
      if (from === 'INITIATED' || from === 'MATERIAL_REVIEW' || from === 'MATERIAL_RETURNED' || from === 'EXAM') {
        return 'WITHDRAWN';
      }
      break;
    case 'timeout':
      if (!TERMINAL_STATES.has(from)) return 'CLOSED_TIMEOUT';
      break;
  }
  throw new IllegalTransition(from, event);
}

import { IllegalTransition, transition, TransitionCtx } from './state-machine';

const ctx: TransitionCtx = { retakeCount: 0, maxRetake: 1, resubmitCount: 0, maxResubmit: 3 };

describe('cert state machine (ticket 03 seam)', () => {
  it('walks the main chain INITIATED -> ... -> EFFECTIVE', () => {
    let s = transition('INITIATED', 'hard_check_pass', ctx);
    s = transition(s, 'material_approve', ctx);
    s = transition(s, 'exam_pass', ctx);
    s = transition(s, 'defense_pass', ctx);
    expect(s).toBe('EFFECTIVE');
  });

  it('hard check fail terminates as UNQUALIFIED', () => {
    expect(transition('INITIATED', 'hard_check_fail', ctx)).toBe('TERMINATED_UNQUALIFIED');
  });

  it('material reject -> returned -> resubmit -> review again (multiple resubmits allowed)', () => {
    let s = transition('MATERIAL_REVIEW', 'material_reject', ctx);
    expect(s).toBe('MATERIAL_RETURNED');
    s = transition(s, 'material_resubmit', ctx);
    expect(s).toBe('MATERIAL_REVIEW');
  });

  it('resubmit blocked once budget exhausted', () => {
    expect(() => transition('MATERIAL_RETURNED', 'material_resubmit', { ...ctx, resubmitCount: 3 })).toThrow(IllegalTransition);
  });

  it('exam fail -> retake (stays EXAM) while budget remains', () => {
    expect(transition('EXAM', 'exam_fail', ctx)).toBe('EXAM');
  });

  it('exam fail with exhausted retake budget terminates', () => {
    expect(transition('EXAM', 'exam_fail', { ...ctx, retakeCount: 1 })).toBe('TERMINATED_EXAM_FAILED');
  });

  it('defense fail terminates with DEFENSE_FAILED', () => {
    expect(transition('DEFENSE_REVIEW', 'defense_fail', ctx)).toBe('TERMINATED_DEFENSE_FAILED');
  });

  it('withdraw allowed before review starts, blocked from DEFENSE_REVIEW', () => {
    expect(transition('INITIATED', 'withdraw', ctx)).toBe('WITHDRAWN');
    expect(transition('MATERIAL_REVIEW', 'withdraw', ctx)).toBe('WITHDRAWN');
    expect(transition('EXAM', 'withdraw', ctx)).toBe('WITHDRAWN');
    expect(() => transition('DEFENSE_REVIEW', 'withdraw', ctx)).toThrow(IllegalTransition);
  });

  it('timeout closes any non-terminal state', () => {
    for (const s of ['INITIATED', 'MATERIAL_REVIEW', 'MATERIAL_RETURNED', 'EXAM', 'DEFENSE_REVIEW'] as const) {
      expect(transition(s, 'timeout', ctx)).toBe('CLOSED_TIMEOUT');
    }
  });

  it('terminal states reject all events', () => {
    for (const s of ['EFFECTIVE', 'TERMINATED_UNQUALIFIED', 'TERMINATED_EXAM_FAILED', 'TERMINATED_DEFENSE_FAILED', 'CLOSED_TIMEOUT', 'WITHDRAWN'] as const) {
      expect(() => transition(s, 'hard_check_pass', ctx)).toThrow(IllegalTransition);
    }
  });

  it('rejects out-of-order events on the main chain', () => {
    expect(() => transition('INITIATED', 'exam_pass', ctx)).toThrow(IllegalTransition);
    expect(() => transition('EXAM', 'defense_pass', ctx)).toThrow(IllegalTransition);
  });
});

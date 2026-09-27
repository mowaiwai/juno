import { analyzeGaps, routeAction } from './gap';

describe('gap analysis seams', () => {
  it('routes each gap type to the correct action', () => {
    expect(routeAction('PERFORMANCE')).toBe('绩效改进');
    expect(routeAction('DUTY')).toBe('过程监督');
    expect(routeAction('ABILITY')).toBe('行为改善');
    expect(routeAction('TEAM_CONTRIB')).toBe('团队任务');
    expect(routeAction('KNOWLEDGE')).toBe('学习');
  });

  it('detects PERFORMANCE gap when latest grade is C', () => {
    const gaps = analyzeGaps(
      { perf_condition: {}, duties: [], abilities: [], knowledge: [] },
      {
        perf_summary: { latest_grade: 'C' },
        duty: { cert_status: 'EFFECTIVE' },
        knowledge: { exam_passed: true },
        ability: { abilities: ['执行力'] },
        team_contrib: { role: '负责人' },
      },
    );
    expect(gaps.some((g) => g.gap_type === 'PERFORMANCE')).toBe(true);
    expect(gaps.find((g) => g.gap_type === 'PERFORMANCE')?.severity).toBe('HIGH');
  });

  it('detects DUTY gap when cert not effective', () => {
    const gaps = analyzeGaps(
      { perf_condition: {}, duties: [], abilities: [], knowledge: [] },
      {
        perf_summary: { latest_grade: 'B' },
        duty: { cert_status: 'INITIATED' },
        knowledge: { exam_passed: true },
        ability: { abilities: ['执行力'] },
        team_contrib: { role: '负责人' },
      },
    );
    expect(gaps.some((g) => g.gap_type === 'DUTY')).toBe(true);
  });

  it('detects KNOWLEDGE gap when exam not passed', () => {
    const gaps = analyzeGaps(
      { perf_condition: {}, duties: [], abilities: [], knowledge: [] },
      {
        perf_summary: { latest_grade: 'B' },
        duty: { cert_status: 'EFFECTIVE' },
        knowledge: { exam_passed: false },
        ability: { abilities: ['执行力'] },
        team_contrib: { role: '负责人' },
      },
    );
    expect(gaps.some((g) => g.gap_type === 'KNOWLEDGE')).toBe(true);
  });
});

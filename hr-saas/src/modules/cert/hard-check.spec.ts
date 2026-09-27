import { hardCheck } from './hard-check';

const emp = (education = '本科', hire = '2021-07-01') => ({ education, hire_date: new Date(hire) });

describe('hardCheck (ticket 03 seam)', () => {
  // Apply year 2026 -> recent two years = 2024, 2025; recent year = 2025

  it('positive P2->P3: one A in two years + recent year B passes', () => {
    const r = hardCheck(
      { education: '本科', work_years: 3 },
      { recent_two_year_min_a: 1, recent_year_min: 'B' },
      emp(),
      [{ period: '2024', grade: 'A' }, { period: '2025', grade: 'B' }],
      2026,
    );
    expect(r.pass).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('negative: C/C fails the A-count and recent-year rules', () => {
    const r = hardCheck(
      { education: '本科', work_years: 3 },
      { recent_two_year_min_a: 1, recent_year_min: 'B' },
      emp(),
      [{ period: '2024', grade: 'C' }, { period: '2025', grade: 'C' }],
      2026,
    );
    expect(r.pass).toBe(false);
    expect(r.reasons.join(';')).toMatch(/近两年A及以上/);
    expect(r.reasons.join(';')).toMatch(/近一年\(2025\)/);
  });

  it('S counts toward the A threshold', () => {
    const r = hardCheck({}, { recent_two_year_min_a: 1 }, emp(), [{ period: '2024', grade: 'S' }], 2026);
    expect(r.pass).toBe(true);
  });

  it('education below requirement fails', () => {
    const r = hardCheck({ education: '硕士' }, {}, emp('本科'), [], 2026);
    expect(r.pass).toBe(false);
    expect(r.reasons[0]).toMatch(/学历不达标/);
  });

  it('work years below requirement fails', () => {
    const r = hardCheck({ work_years: 5 }, {}, emp('本科', '2024-01-01'), [], 2026);
    expect(r.pass).toBe(false);
    expect(r.reasons[0]).toMatch(/工龄不达标/);
  });

  it('sub-year periods (H1/Q) count toward their calendar year', () => {
    const r = hardCheck({}, { recent_two_year_min_a: 1, recent_year_min: 'B' }, emp(), [
      { period: '2024-H2', grade: 'A' }, { period: '2025-Q4', grade: 'B' },
    ], 2026);
    expect(r.pass).toBe(true);
  });

  it('missing recent-year record fails recent_year_min', () => {
    const r = hardCheck({}, { recent_year_min: 'B' }, emp(), [{ period: '2024', grade: 'A' }], 2026);
    expect(r.pass).toBe(false);
    expect(r.reasons[0]).toMatch(/无记录/);
  });

  it('empty conditions always pass', () => {
    expect(hardCheck({}, {}, emp(), [], 2026).pass).toBe(true);
  });
});

import { buildDimensionData, canViewProfile } from './profile';

describe('profile seams', () => {
  it('builds 7 dimensions from employee + perfs', () => {
    const d = buildDimensionData(
      { education: '本科', hire_date: new Date('2021-07-01'), grade: 'P2' },
      [{ period: '2024', grade: 'A' }, { period: '2025', grade: 'B' }],
    );
    expect(d.basic.current_grade).toBe('P2');
    expect(d.basic.education).toBe('本科');
    expect(d.performance.periods).toHaveLength(2);
    expect(d.perf_summary.latest_grade).toBe('B');
    expect(d.potential.note).toBe('');
  });

  it('exam passed flag when exam record is present', () => {
    const d = buildDimensionData(
      { education: '本科', hire_date: null, grade: 'P3' },
      [],
      { passed: 1 },
    );
    expect(d.knowledge.exam_passed).toBe(true);
  });

  it('role mask: EMPLOYEE only sees self', () => {
    expect(canViewProfile('EMPLOYEE', 'e1', 'e1', false)).toBe(true);
    expect(canViewProfile('EMPLOYEE', 'e1', 'e2', false)).toBe(false);
  });

  it('role mask: MANAGER sees self + direct reports', () => {
    expect(canViewProfile('MANAGER', 'm1', 'm1', false)).toBe(true);
    expect(canViewProfile('MANAGER', 'm1', 'e1', true)).toBe(true);
    expect(canViewProfile('MANAGER', 'm1', 'e2', false)).toBe(false);
  });

  it('role mask: HR/EXEC sees all', () => {
    expect(canViewProfile('HR', 'h1', 'e1', false)).toBe(true);
    expect(canViewProfile('EXEC', 'c1', 'e1', false)).toBe(true);
  });
});

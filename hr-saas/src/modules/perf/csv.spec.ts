import { parsePerfCsv } from './csv';

describe('parsePerfCsv (ticket 01 seam)', () => {
  it('parses valid rows', () => {
    const csv = 'employee_no,period,grade,remark\nE001,2024,A,annual\nE002,2025-H1,B,';
    const r = parsePerfCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { employee_no: 'E001', period: '2024', grade: 'A', remark: 'annual' },
      { employee_no: 'E002', period: '2025-H1', grade: 'B', remark: '' },
    ]);
  });

  it('rejects invalid grade', () => {
    const r = parsePerfCsv('employee_no,period,grade\nE001,2024,X');
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/grade/);
  });

  it('rejects invalid period format', () => {
    const r = parsePerfCsv('employee_no,period,grade\nE001,24-01,A');
    expect(r.errors[0]).toMatch(/period/);
  });

  it('accepts quarter and half-year periods', () => {
    const r = parsePerfCsv('employee_no,period,grade\nE001,2025-Q3,S\nE001,2025-H2,C\nE001,2025,D');
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.period)).toEqual(['2025-Q3', '2025-H2', '2025']);
  });

  it('flags missing employee_no and skips blank lines', () => {
    const r = parsePerfCsv('employee_no,period,grade\n,2024,A\n\nE002,2024,B');
    expect(r.rows).toHaveLength(1);
    expect(r.errors[0]).toMatch(/employee_no/);
  });

  it('errors when header is wrong', () => {
    const r = parsePerfCsv('a,b,c\nE001,2024,A');
    expect(r.errors[0]).toMatch(/header/);
  });
});

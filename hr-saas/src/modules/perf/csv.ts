// CSV parsing for perf_result import (ticket 01).
// Template header: employee_no,period,grade,remark
// period formats: 2024 | 2024-H1 | 2024-H2 | 2024-Q1..Q4
// grade: S | A | B | C | D

export interface PerfCsvRow {
  employee_no: string;
  period: string;
  grade: string;
  remark: string;
}

export interface PerfCsvResult {
  rows: PerfCsvRow[];
  errors: string[]; // human-readable, e.g. "line 3: invalid grade 'X'"
}

const GRADES = new Set(['S', 'A', 'B', 'C', 'D']);
const PERIOD_RE = /^\d{4}(-(H[12]|Q[1-4]))?$/;

export function parsePerfCsv(content: string): PerfCsvResult {
  const rows: PerfCsvRow[] = [];
  const errors: string[] = [];
  const lines = content
    .replace(/^﻿/, '') // strip BOM
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows, errors: ['empty file'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  if (header[0] !== 'employee_no' || header[1] !== 'period' || header[2] !== 'grade') {
    return { rows, errors: [`bad header: expected "employee_no,period,grade[,remark]", got "${lines[0]}"`] };
  }

  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    const cells = lines[i].split(',').map((c) => c.trim());
    const [employee_no, period, grade, remark = ''] = cells;
    if (!employee_no) {
      errors.push(`line ${lineNo}: missing employee_no`);
      continue;
    }
    if (!PERIOD_RE.test(period)) {
      errors.push(`line ${lineNo}: invalid period '${period}' (expected 2024 | 2024-H1 | 2024-Q3)`);
      continue;
    }
    if (!GRADES.has(grade)) {
      errors.push(`line ${lineNo}: invalid grade '${grade}' (S/A/B/C/D)`);
      continue;
    }
    rows.push({ employee_no, period, grade, remark });
  }
  return { rows, errors };
}

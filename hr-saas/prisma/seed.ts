/**
 * Ticket 01: virtual tenant seed data (ADR-0009 虚拟数据).
 * One virtual company "云帆科技" (tenant DEMO), 4-level dept tree (10 depts),
 * target sequence 软件研发 P1-P5, 2-3 background positions, ~20 employees,
 * 2 years of perf results covering hard-check positive & negative cases.
 *
 * All ids are deterministic so tests can reference them.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const TENANT_ID = 't-demo';
export const DEPT = {
  root: 'd-root',
  rd: 'd-rd',
  platform: 'd-platform',
  app: 'd-app',
  fe: 'd-fe',
  be: 'd-be',
  qa: 'd-qa',
  product: 'd-product',
  market: 'd-market',
  hr: 'd-hr',
} as const;

export const CHANNEL_IDS = ['ch-sw-p1', 'ch-sw-p2', 'ch-sw-p3', 'ch-sw-p4', 'ch-sw-p5'] as const;

async function main() {
  // Wipe existing demo data (idempotent reseed)
  await prisma.$transaction([
    prisma.idp.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.gap_analysis.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.profile_snapshot.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.exam_record.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.exam_question.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.exam_paper.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.cert_audit_log.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.cert_record.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.perf_result.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.qc_standard_ability.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.qc_standard_knowledge.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.qc_standard_duty.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.qc_standard.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.org_employee.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.org_position.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.qc_channel.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.org_department.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.ai_usage.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.tenant_config.deleteMany({ where: { tenant_id: TENANT_ID } }),
    prisma.tenant.deleteMany({ where: { id: TENANT_ID } }),
  ]);

  await prisma.tenant.create({ data: { id: TENANT_ID, name: '云帆科技（虚拟）', code: 'DEMO' } });

  // ---- Department tree (4 levels, 10 depts) ----
  const depts = [
    { id: DEPT.root, parent_id: null, name: '云帆科技' },
    { id: DEPT.rd, parent_id: DEPT.root, name: '研发中心' },
    { id: DEPT.platform, parent_id: DEPT.rd, name: '平台研发部' },
    { id: DEPT.app, parent_id: DEPT.rd, name: '应用研发部' },
    { id: DEPT.fe, parent_id: DEPT.app, name: '前端组' },
    { id: DEPT.be, parent_id: DEPT.app, name: '后端组' },
    { id: DEPT.qa, parent_id: DEPT.rd, name: '质量部' },
    { id: DEPT.product, parent_id: DEPT.root, name: '产品部' },
    { id: DEPT.market, parent_id: DEPT.root, name: '市场部' },
    { id: DEPT.hr, parent_id: DEPT.root, name: '人力资源部' },
  ];
  await prisma.org_department.createMany({
    data: depts.map((d, i) => ({ ...d, tenant_id: TENANT_ID, sort: i })),
  });

  // ---- Grade channel: 软件研发 P1-P5 (family P) ----
  const roles = ['在指导下完成模块开发', '独立完成模块开发', '主导子系统设计', '主导系统设计与技术攻坚', '技术方向规划与跨团队影响'];
  await prisma.qc_channel.createMany({
    data: CHANNEL_IDS.map((id, i) => ({
      id,
      tenant_id: TENANT_ID,
      family: 'P',
      sequence_name: '软件研发',
      grade: `P${i + 1}`,
      grade_order: i + 1,
      role_definition: roles[i],
    })),
  });

  // ---- Positions: 1 target-sequence + 3 background ----
  await prisma.org_position.createMany({
    data: [
      { id: 'pos-swe', tenant_id: TENANT_ID, name: '软件工程师', channel_id: CHANNEL_IDS[0] }, // channel_id -> sequence's P1 row (MVP convention)
      { id: 'pos-pm', tenant_id: TENANT_ID, name: '产品经理', channel_id: null },
      { id: 'pos-mkt', tenant_id: TENANT_ID, name: '市场专员', channel_id: null },
      { id: 'pos-hrs', tenant_id: TENANT_ID, name: 'HR 专员', channel_id: null },
    ],
  });

  // ---- Employees ----
  const emp = (id: string, no: string, name: string, dept: string, pos: string, grade: string, role: string, manager_id: string | null, hire: string, education = '本科') => ({
    id, employee_no: no, name, dept_id: dept, position_id: pos, grade, role, manager_id,
    hire_date: new Date(hire), education, tenant_id: TENANT_ID,
  });
  await prisma.org_employee.createMany({
    data: [
      emp('e-exec', 'E900', '陈远帆', DEPT.rd, 'pos-swe', 'M1', 'EXEC', null, '2015-03-01', '硕士'),
      emp('e-hr', 'E901', '刘人力', DEPT.hr, 'pos-hrs', 'M1', 'HR', 'e-exec', '2016-06-01'),
      emp('e-mgr-rd', 'E100', '赵研发', DEPT.rd, 'pos-swe', 'P5', 'MANAGER', 'e-exec', '2016-01-15', '硕士'),
      emp('e-mgr-platform', 'E101', '钱平台', DEPT.platform, 'pos-swe', 'P4', 'MANAGER', 'e-mgr-rd', '2017-04-01'),
      emp('e-mgr-app', 'E102', '孙应用', DEPT.app, 'pos-swe', 'P4', 'MANAGER', 'e-mgr-rd', '2017-05-01'),
      // target sequence engineers
      emp('e-eng-001', 'E001', '李正例', DEPT.be, 'pos-swe', 'P2', 'EMPLOYEE', 'e-mgr-app', '2021-07-01'), // P2->P3 positive
      emp('e-eng-002', 'E002', '王反例', DEPT.be, 'pos-swe', 'P2', 'EMPLOYEE', 'e-mgr-app', '2022-07-01'), // negative
      emp('e-eng-003', 'E003', '张进阶', DEPT.fe, 'pos-swe', 'P1', 'EMPLOYEE', 'e-mgr-app', '2023-07-01'), // P1->P2
      emp('e-eng-004', 'E004', '吴高潜', DEPT.platform, 'pos-swe', 'P3', 'EMPLOYEE', 'e-mgr-platform', '2020-03-01', '硕士'), // P3->P4 positive
      emp('e-eng-005', 'E005', '郑平稳', DEPT.platform, 'pos-swe', 'P3', 'EMPLOYEE', 'e-mgr-platform', '2020-08-01'), // P3, no A
      emp('e-eng-006', 'E006', '林小测', DEPT.qa, 'pos-swe', 'P1', 'EMPLOYEE', 'e-mgr-rd', '2024-01-01'),
      emp('e-eng-007', 'E007', '何稳定', DEPT.fe, 'pos-swe', 'P2', 'EMPLOYEE', 'e-mgr-app', '2021-11-01'),
      emp('e-eng-008', 'E008', '罗新秀', DEPT.be, 'pos-swe', 'P1', 'EMPLOYEE', 'e-mgr-app', '2024-07-01'),
      emp('e-eng-009', 'E009', '梁骨干', DEPT.platform, 'pos-swe', 'P4', 'EMPLOYEE', 'e-mgr-platform', '2017-05-01', '硕士'),
      emp('e-eng-014', 'E014', '苏可审', DEPT.be, 'pos-swe', 'P2', 'EMPLOYEE', 'e-mgr-app', '2021-06-01'),
      emp('e-eng-015', 'E015', '潘超时', DEPT.fe, 'pos-swe', 'P2', 'EMPLOYEE', 'e-mgr-app', '2021-08-01'),
      emp('e-eng-010', 'E010', '谢资深', DEPT.platform, 'pos-swe', 'P5', 'EMPLOYEE', 'e-mgr-rd', '2016-09-01', '博士'),
      emp('e-eng-011', 'E011', '唐后端', DEPT.be, 'pos-swe', 'P2', 'EMPLOYEE', 'e-mgr-app', '2022-03-01'),
      emp('e-eng-012', 'E012', '冯前端', DEPT.fe, 'pos-swe', 'P2', 'EMPLOYEE', 'e-mgr-app', '2022-09-01'),
      emp('e-eng-013', 'E013', '董质量', DEPT.qa, 'pos-swe', 'P2', 'EMPLOYEE', 'e-mgr-rd', '2021-05-01'),
      // background
      emp('e-bk-001', 'E301', '许产品', DEPT.product, 'pos-pm', 'M1', 'EMPLOYEE', 'e-exec', '2019-04-01'),
      emp('e-bk-002', 'E302', '沈市场', DEPT.market, 'pos-mkt', 'M1', 'EMPLOYEE', 'e-exec', '2020-10-01'),
    ],
  });

  // ---- Perf results: 2024 + 2025, covering hard-check positive/negative ----
  const perf = (eid: string, period: string, grade: string) => ({
    id: `pf-${eid}-${period}`, tenant_id: TENANT_ID, employee_id: eid, period, grade,
    source: 2, created_by: 'seed',
  });
  await prisma.perf_result.createMany({
    data: [
      // e-eng-001 positive for P2->P3: one A in two years, recent year >= B
      perf('e-eng-001', '2024', 'A'), perf('e-eng-001', '2025', 'B'),
      // e-eng-002 negative: C/C
      perf('e-eng-002', '2024', 'C'), perf('e-eng-002', '2025', 'C'),
      // e-eng-003 P1->P2: B/B (recent year >= B)
      perf('e-eng-003', '2024', 'B'), perf('e-eng-003', '2025', 'B'),
      // e-eng-004 positive for P3->P4: two A
      perf('e-eng-004', '2024', 'A'), perf('e-eng-004', '2025', 'A'),
      // e-eng-005 P3 no A: B/B
      perf('e-eng-005', '2024', 'B'), perf('e-eng-005', '2025', 'B'),
      perf('e-eng-006', '2025', 'B'),
      perf('e-eng-007', '2024', 'S'), perf('e-eng-007', '2025', 'A'),
      perf('e-eng-008', '2025', 'C'),
      perf('e-eng-009', '2024', 'A'), perf('e-eng-009', '2025', 'A'),
      perf('e-eng-010', '2024', 'S'), perf('e-eng-010', '2025', 'A'),
      perf('e-eng-011', '2024', 'A'), perf('e-eng-011', '2025', 'B'), // ticket04 objective-only positive
      perf('e-eng-012', '2024', 'A'), perf('e-eng-012', '2025', 'B'), // ticket04 mixed paper positive
      perf('e-eng-013', '2024', 'A'), perf('e-eng-013', '2025', 'B'),
      perf('e-eng-014', '2024', 'A'), perf('e-eng-014', '2025', 'B'),
      perf('e-eng-015', '2024', 'A'), perf('e-eng-015', '2025', 'B'),
      perf('e-mgr-platform', '2024', 'A'), perf('e-mgr-platform', '2025', 'A'),
      perf('e-mgr-app', '2024', 'B'), perf('e-mgr-app', '2025', 'A'),
      perf('e-mgr-rd', '2024', 'A'), perf('e-mgr-rd', '2025', 'S'),
    ],
  });

  console.log('seed done: tenant DEMO, 10 depts, channel 软件研发 P1-P5, 20 employees, perf 2024-2025');
}

if (require.main === module) {
  main().finally(() => prisma.$disconnect());
}

export default main;

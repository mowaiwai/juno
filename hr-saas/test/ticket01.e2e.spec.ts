/**
 * Ticket 01 acceptance:
 *  1. Target-sequence employee: dept tree path + position + grade + 2-year perf queryable
 *  2. /perf/import: positive & negative samples persisted with trace (import_batch)
 *  3. All data carries tenant_id; a second tenant sees nothing of tenant 1
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as http from 'http';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { PrismaService } from '../src/common/prisma.service';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import seed, { TENANT_ID } from '../prisma/seed';

process.env.DATABASE_URL = 'file:./test.db';

describe('ticket01 virtual tenant (e2e)', () => {
  let app: INestApplication;
  let server: http.Server;
  let prisma: PrismaService;
  let base: string;

  const req = (method: string, path: string, body?: any, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; body: any }>((resolve, reject) => {
      const data = body ? JSON.stringify(body) : undefined;
      const r = http.request(
        base + path,
        { method, headers: { 'content-type': 'application/json', ...(data ? { 'content-length': String(Buffer.byteLength(data)) } : {}), ...headers } },
        (res) => {
          let buf = '';
          res.on('data', (c) => (buf += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf ? JSON.parse(buf) : null }));
        },
      );
      r.on('error', reject);
      if (data) r.write(data);
      r.end();
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/hr');
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer();
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as any).port}/api/hr`;
    prisma = app.get(PrismaService);
    await seed();
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  it('1. employee detail exposes dept path, position, grade, 2y perf', async () => {
    const res = await req('GET', '/org/employee/e-eng-001');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.dept_path).toEqual(['云帆科技', '研发中心', '应用研发部', '后端组']);
    expect(d.position_name).toBe('软件工程师');
    expect(d.grade).toBe('P2');
    expect(d.manager_name).toBe('孙应用');
    expect(d.perf_results.map((p: any) => `${p.period}:${p.grade}`)).toEqual(['2024:A', '2025:B']);
  });

  it('2a. CSV import persists positive sample rows with import_batch trace', async () => {
    const csv = 'employee_no,period,grade,remark\nE001,2026-H1,A,mid-year\nE002,2026-H1,B,';
    const res = await req('POST', '/perf/import', { csv_content: csv }, { 'x-employee-id': 'e-hr' });
    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.errors).toEqual([]);
    const rows = await prisma.perf_result.findMany({ where: { tenant_id: TENANT_ID, import_batch: res.body.data.batch } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.created_by === 'e-hr' && r.source === 1)).toBe(true);
  });

  it('2b. import flags invalid rows and unknown employees without aborting valid ones', async () => {
    const csv = 'employee_no,period,grade\nE001,2026,X\nE999,2026,A\nE003,2026-H1,B';
    const res = await req('POST', '/perf/import', { csv_content: csv });
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.skipped).toBe(1);
    expect(res.body.data.errors.join(';')).toMatch(/invalid grade/);
    expect(res.body.data.errors.join(';')).toMatch(/E999: 员工不存在/);
  });

  it('2c. import is idempotent per employee+period (upsert)', async () => {
    const csv = 'employee_no,period,grade\nE001,2026-H1,S';
    const res = await req('POST', '/perf/import', { csv_content: csv });
    expect(res.body.data.imported).toBe(1);
    const row = await prisma.perf_result.findFirst({ where: { tenant_id: TENANT_ID, employee_id: 'e-eng-001', period: '2026-H1' } });
    expect(row?.grade).toBe('S');
  });

  it('3. second tenant is isolated from demo tenant data', async () => {
    await prisma.tenant.upsert({
      where: { id: 't-other' },
      update: {},
      create: { id: 't-other', name: '第二租户', code: 'OTHER' },
    });
    const res = await req('GET', '/org/employee/e-eng-001', undefined, { 'x-tenant-id': 't-other' });
    expect(res.status).toBe(404);
    const perfRes = await req('GET', '/perf/employee/e-eng-001', undefined, { 'x-tenant-id': 't-other' });
    expect(perfRes.body.data).toEqual([]);
  });
});

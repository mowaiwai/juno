/**
 * Ticket 05 acceptance: profile engine.
 * - perf import triggers first profile snapshot for target-sequence employees
 * - cert EFFECTIVE triggers new version; current_grade reflects promoted grade
 * - role mask: EMPLOYEE sees own only; MANAGER sees own + direct reports; HR sees all
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as http from 'http';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { PrismaService } from '../src/common/prisma.service';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import seed, { TENANT_ID } from '../prisma/seed';
import { seedStandard } from '../prisma/seed-standard';

process.env.DATABASE_URL = 'file:./test.db';

describe('ticket05 profile engine (e2e)', () => {
  let app: INestApplication;
  let server: http.Server;
  let prisma: PrismaService;
  let base: string;

  const req = (method: string, path: string, body?: any, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; body: any }>((resolve, reject) => {
      const data = body ? JSON.stringify(body) : undefined;
      const r = http.request(base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(data ? { 'content-length': String(Buffer.byteLength(data)) } : {}), ...headers },
      }, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf ? JSON.parse(buf) : null }));
      });
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
    await seedStandard();
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  it('perf import triggers first profile snapshot for target-sequence employees', async () => {
    // no snapshot yet
    let snap = await prisma.profile_snapshot.findFirst({ where: { tenant_id: TENANT_ID, employee_id: 'e-eng-001' } });
    expect(snap).toBeNull();

    const csv = `employee_no,period,grade,remark
E001,2026,B,import-trigger-test`;
    const r = await req('POST', '/perf/import', { csv_content: csv }, { 'x-employee-id': 'e-hr' });
    expect(r.status).toBe(201);
    expect(r.body.data.imported).toBe(1);

    snap = await prisma.profile_snapshot.findFirst({
      where: { tenant_id: TENANT_ID, employee_id: 'e-eng-001', is_current: 1 },
    });
    expect(snap).toBeTruthy();
    expect(snap?.trigger_source).toBe('perf_import');
    expect(snap?.version).toBe(1);
    const dim = JSON.parse(snap!.dimension_data);
    expect(dim.basic.current_grade).toBe('P2');
    expect(dim.perf_summary.latest_period).toBe('2026');
    expect(dim.perf_summary.latest_grade).toBe('B');
  });

  it('cert EFFECTIVE triggers new version with promoted grade', async () => {
    // e-eng-007 walks full chain to EFFECTIVE
    const apply = (await req('POST', '/cert/apply', { employee_id: 'e-eng-007' })).body.data;
    const certId = apply.cert.id;
    await req('POST', '/cert/material', { cert_id: certId, materials: [{ type: 'doc', name: 'x.pdf' }] });
    await req('POST', '/cert/material/review', { cert_id: certId, approve: true }, { 'x-employee-id': 'e-hr' });

    // exam: generate + publish + submit (objective-only shortcut)
    const g = await req('POST', '/exam/generate', { standard_id: 'std-sw-p3' }, { 'x-employee-id': 'e-hr' });
    const paperId = g.body.data.paper.id;
    await prisma.exam_question.deleteMany({ where: { tenant_id: TENANT_ID, paper_id: paperId, type: { in: ['QA', 'DEFENSE'] } } });
    const qs = await prisma.exam_question.findMany({ where: { tenant_id: TENANT_ID, paper_id: paperId } });
    const total = qs.reduce((s, q) => s + q.score, 0);
    await prisma.exam_paper.update({ where: { id: paperId }, data: { total_score: total, pass_score: Math.ceil(total * 0.6) } });
    await req('POST', '/exam/paper/review', { paper_id: paperId, approve: true }, { 'x-employee-id': 'e-hr' });
    const answers = qs.map((q) => ({ question_id: q.id, answer: q.answer }));
    await req('POST', '/exam/submit', { paper_id: paperId, employee_id: 'e-eng-007', answers, cert_id: certId });

    // panel vote (P2->P3 route)
    await req('POST', '/cert/review', { cert_id: certId, voter_id: 'e-mgr-app', approve: true, comment: 'ok' });
    const cert = (await req('GET', `/cert/${certId}`)).body.data;
    expect(cert.status).toBe('EFFECTIVE');

    const snap = await prisma.profile_snapshot.findFirst({
      where: { tenant_id: TENANT_ID, employee_id: 'e-eng-007', trigger_source: 'cert_effective', is_current: 1 },
    });
    expect(snap).toBeTruthy();
    expect(snap?.current_grade).toBe('P3');
    const dim = JSON.parse(snap!.dimension_data);
    expect(dim.basic.current_grade).toBe('P3');
  });

  it('role mask: employee sees own; other employee gets 403', async () => {
    const own = await req('GET', '/profile/e-eng-001', undefined, { 'x-employee-id': 'e-eng-001' });
    expect(own.status).toBe(200);
    expect(own.body.data.employee.id).toBe('e-eng-001');

    const other = await req('GET', '/profile/e-eng-001', undefined, { 'x-employee-id': 'e-eng-002' });
    expect(other.status).toBe(403);
  });

  it('role mask: manager sees direct report; HR sees anyone', async () => {
    const byMgr = await req('GET', '/profile/e-eng-001', undefined, { 'x-employee-id': 'e-mgr-app' });
    expect(byMgr.status).toBe(200);
    expect(byMgr.body.data.employee.id).toBe('e-eng-001');

    const byHr = await req('GET', '/profile/e-eng-002', undefined, { 'x-employee-id': 'e-hr' });
    expect(byHr.status).toBe(200);
  });
});

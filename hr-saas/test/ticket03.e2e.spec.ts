/**
 * Ticket 03 acceptance: cert state machine + routing e2e.
 * Positive: P2->P3 employee walks apply -> check -> material -> exam pass -> panel vote -> EFFECTIVE
 * Negative: unqualified perf -> TERMINATED_UNQUALIFIED, no review records
 * Branches: exam fail retake -> terminate, withdraw, timeout, material reject/resubmit
 * All transitions audited (operator/time/reason/from-to).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as http from 'http';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { PrismaService } from '../src/common/prisma.service';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import { CertService } from '../src/modules/cert/cert.service';
import seed, { TENANT_ID } from '../prisma/seed';
import { seedStandard } from '../prisma/seed-standard';

process.env.DATABASE_URL = 'file:./test.db';

describe('ticket03 cert state machine (e2e)', () => {
  let app: INestApplication;
  let server: http.Server;
  let prisma: PrismaService;
  let certService: CertService;
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

  const applyCert = async (employeeId: string) => (await req('POST', '/cert/apply', { employee_id: employeeId })).body.data;
  const material = (certId: string) => req('POST', '/cert/material', { cert_id: certId, materials: [{ type: 'doc', name: '项目总结.pdf' }] });
  const materialApprove = (certId: string) => req('POST', '/cert/material/review', { cert_id: certId, approve: true }, { 'x-employee-id': 'e-hr' });

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
    certService = app.get(CertService);
    await seed();
    await seedStandard();
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  it('positive P2->P3: full chain to EFFECTIVE with audit trail', async () => {
    const { cert, auto_check } = await applyCert('e-eng-001');
    expect(auto_check.pass).toBe(true);
    expect(cert.status).toBe('MATERIAL_REVIEW');
    expect(cert.review_route).toBe('PANEL_VOTE');
    expect(cert.to_grade).toBe('P3');

    await material(cert.id);
    const approved = await materialApprove(cert.id);
    expect(approved.body.data.status).toBe('EXAM');

    // exam gate (ticket 04 owns generation; here drive the seam directly)
    const afterExam = await certService.examResult(TENANT_ID, cert.id, true, 'exam-rec-1', 'e-hr');
    expect(afterExam.status).toBe('DEFENSE_REVIEW');

    const vote = await req('POST', '/cert/review', { cert_id: cert.id, voter_id: 'e-mgr-app', approve: true, comment: '同意晋升' });
    expect(vote.body.data.cert.status).toBe('EFFECTIVE');
    expect(vote.body.data.cert.effective_at).toBeTruthy();

    const detail = (await req('GET', `/cert/${cert.id}`)).body.data;
    const actions = detail.audit_logs.map((l: any) => `${l.action}:${l.from_status}->${l.to_status}`);
    expect(actions).toEqual([
      'apply:->INITIATED',
      'hard_check_pass:INITIATED->MATERIAL_REVIEW',
      'material_approve:MATERIAL_REVIEW->EXAM',
      'exam_pass:EXAM->DEFENSE_REVIEW',
      'defense_pass:DEFENSE_REVIEW->EFFECTIVE',
    ]);
    expect(detail.audit_logs.every((l: any) => l.operator_id && l.created_at)).toBe(true);
  });

  it('negative: unqualified perf terminates at hard check with no review records', async () => {
    const { cert, auto_check } = await applyCert('e-eng-002');
    expect(auto_check.pass).toBe(false);
    expect(auto_check.reasons.join(';')).toMatch(/近两年A及以上/);
    expect(cert.status).toBe('TERMINATED_UNQUALIFIED');
    const votes = await prisma.cert_review_vote.findMany({ where: { tenant_id: TENANT_ID, cert_id: cert.id } });
    expect(votes).toHaveLength(0);
    const detail = (await req('GET', `/cert/${cert.id}`)).body.data;
    expect(detail.terminate_reason).toMatch(/业绩条件不达标/);
  });

  it('exam fail -> one retake -> fail again -> TERMINATED_EXAM_FAILED', async () => {
    const { cert } = await applyCert('e-eng-007'); // S/A passes hard check
    await material(cert.id);
    await materialApprove(cert.id);

    const fail1 = await certService.examResult(TENANT_ID, cert.id, false, 'er-1', 'e-hr');
    expect(fail1.status).toBe('EXAM'); // retake window open
    expect(fail1.retake_count).toBe(1);

    const fail2 = await certService.examResult(TENANT_ID, cert.id, false, 'er-2', 'e-hr');
    expect(fail2.status).toBe('TERMINATED_EXAM_FAILED');
  });

  it('material reject -> resubmit -> review again', async () => {
    const { cert } = await applyCert('e-eng-013');
    await material(cert.id);
    const rejected = await req('POST', '/cert/material/review', { cert_id: cert.id, approve: false, reason: '材料不全' }, { 'x-employee-id': 'e-hr' });
    expect(rejected.body.data.status).toBe('MATERIAL_RETURNED');

    const resub = await req('POST', '/cert/material', { cert_id: cert.id, materials: [{ type: 'doc', name: '补充材料.pdf' }] });
    expect(resub.body.data.status).toBe('MATERIAL_REVIEW');
    expect(resub.body.data.resubmit_count).toBe(1);
  });

  it('withdraw allowed before defense, blocked after', async () => {
    const { cert } = await applyCert('e-eng-003'); // P1->P2
    expect(cert.status).toBe('MATERIAL_REVIEW');
    const wd = await req('POST', '/cert/withdraw', { cert_id: cert.id, reason: '个人原因' });
    expect(wd.body.data.status).toBe('WITHDRAWN');
  });

  it('withdraw blocked once DEFENSE_REVIEW starts', async () => {
    const { cert } = await applyCert('e-eng-014'); // P2->P3 positive
    await material(cert.id);
    await materialApprove(cert.id);
    await certService.examResult(TENANT_ID, cert.id, true, 'er-3', 'e-hr');
    const res = await req('POST', '/cert/withdraw', { cert_id: cert.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/非法状态迁移/);
  });

  it('timeout closes a stuck application', async () => {
    const { cert } = await applyCert('e-eng-015');
    const res = await req('POST', '/cert/timeout', { cert_id: cert.id });
    expect(res.body.data.status).toBe('CLOSED_TIMEOUT');
  });

  it('manager single review route for P1->P2 (PANEL not required)', async () => {
    const { cert } = await applyCert('e-eng-006'); // P1->P2, 2025 B passes recent_year_min
    expect(cert.review_route).toBe('MANAGER_SINGLE');
    await material(cert.id);
    await materialApprove(cert.id);
    await certService.examResult(TENANT_ID, cert.id, true, 'er-4', 'e-hr');
    const vote = await req('POST', '/cert/review', { cert_id: cert.id, voter_id: 'e-mgr-rd', approve: true, comment: 'ok' });
    expect(vote.body.data.cert.status).toBe('EFFECTIVE');
  });

  it('duplicate in-flight application is rejected', async () => {
    const { cert } = await applyCert('e-eng-004'); // P3->P4 positive
    expect(cert.status).toBe('MATERIAL_REVIEW');
    const again = await req('POST', '/cert/apply', { employee_id: 'e-eng-004' });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/进行中/);
  });
});

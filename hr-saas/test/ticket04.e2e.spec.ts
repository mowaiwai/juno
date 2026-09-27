/**
 * Ticket 04 acceptance: AI exam generation → review → online exam → retake.
 * - knowledge 四档 maps to CHOICE/FILL/QA/DEFENSE
 * - paper starts AI_PENDING_REVIEW; cannot submit before publish; ai_usage row written
 * - objective-only paper auto-grades; mixed paper needs manual grading
 * - fail -> retake -> still fail -> cert TERMINATED_EXAM_FAILED
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

describe('ticket04 ai exam (e2e)', () => {
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

  const applyAndAdvanceToExam = async (employeeId: string) => {
    const { body: a } = await req('POST', '/cert/apply', { employee_id: employeeId });
    expect(a.data.auto_check.pass).toBe(true);
    const certId = a.data.cert.id;
    await req('POST', '/cert/material', { cert_id: certId, materials: [{ type: 'doc', name: 'x.pdf' }] });
    const m = await req('POST', '/cert/material/review', { cert_id: certId, approve: true }, { 'x-employee-id': 'e-hr' });
    expect(m.body.data.status).toBe('EXAM');
    return certId;
  };

  /** Generate + publish a paper for a target grade; strip QA/DEFENSE if objectiveOnly. */
  const makePaper = async (grade: 'p2' | 'p3', objectiveOnly: boolean) => {
    const standardId = `std-sw-${grade}`;
    const g = await req('POST', '/exam/generate', { standard_id: standardId }, { 'x-employee-id': 'e-hr' });
    expect(g.body.data.paper.status).toBe('AI_PENDING_REVIEW');
    const paperId = g.body.data.paper.id;
    if (objectiveOnly) {
      // HR edits the draft before publish: drop subjective questions
      await prisma.exam_question.deleteMany({ where: { tenant_id: TENANT_ID, paper_id: paperId, type: { in: ['QA', 'DEFENSE'] } } });
    }
    const remaining = await prisma.exam_question.findMany({ where: { tenant_id: TENANT_ID, paper_id: paperId } });
    const total = remaining.reduce((s, q) => s + q.score, 0);
    // align pass threshold to actual paper total (tenant default 60 assumes 100-point paper)
    await prisma.exam_paper.update({ where: { id: paperId }, data: { total_score: total, pass_score: Math.ceil(total * 0.6) } });
    await req('POST', '/exam/paper/review', { paper_id: paperId, approve: true }, { 'x-employee-id': 'e-hr' });
    const full = (await req('GET', `/exam/paper/${paperId}`)).body.data;
    return full;
  };

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

  it('generate: paper for P3 standard has 四档 question types, AI_PENDING_REVIEW, ai_usage logged', async () => {
    const g = await req('POST', '/exam/generate', { standard_id: 'std-sw-p3' }, { 'x-employee-id': 'e-hr' });
    expect(g.status).toBe(201);
    const { paper, question_count } = g.body.data;
    expect(paper.status).toBe('AI_PENDING_REVIEW');
    expect(paper.title).toContain('AI 生成·待审核');
    expect(paper.source).toBe(1);
    expect(question_count).toBe(3); // P3 standard has 3 knowledge points (levels 3,2,2)

    const full = (await req('GET', `/exam/paper/${paper.id}`)).body.data;
    const types = full.questions.map((q: any) => q.type).sort();
    expect(types).toEqual(['FILL', 'FILL', 'QA']); // 熟练掌握→QA; 掌握→FILL ×2

    const usage = await prisma.ai_usage.findFirst({ where: { tenant_id: TENANT_ID, scene: 'exam_generate' } });
    expect(usage).toBeTruthy();
    expect(usage?.desensitized).toBe(0); // 出题不涉人员数据
    expect(usage?.request_summary).toContain('std-sw-p3');
  });

  it('cannot submit to unpublished paper; after publish objective-only paper auto-grades and advances cert', async () => {
    const certId = await applyAndAdvanceToExam('e-eng-011');
    const paper = await makePaper('p3', true);

    // generate an unpublished one to assert the gate
    const g2 = await req('POST', '/exam/generate', { standard_id: 'std-sw-p3' }, { 'x-employee-id': 'e-hr' });
    const blocked = await req('POST', '/exam/submit', { paper_id: g2.body.data.paper.id, employee_id: 'e-eng-011', answers: [] });
    expect(blocked.status).toBe(403);

    const answers = paper.questions.map((q: any) => ({ question_id: q.id, answer: q.answer }));
    const s = await req('POST', '/exam/submit', { paper_id: paper.id, employee_id: 'e-eng-011', answers, cert_id: certId });
    expect(s.body.data.status).toBe('GRADED');
    expect(s.body.data.passed).toBe(1);
    expect(s.body.data.total_score).toBeGreaterThanOrEqual(paper.pass_score);

    const cert = (await req('GET', `/cert/${certId}`)).body.data;
    expect(cert.status).toBe('DEFENSE_REVIEW');
  });

  it('mixed paper: objective auto, QA/DEFENSE manual; HR grade decides pass and advances cert', async () => {
    const certId = await applyAndAdvanceToExam('e-eng-012');
    const paper = await makePaper('p3', false);
    expect(paper.questions.some((q: any) => q.type === 'QA' || q.type === 'DEFENSE')).toBe(true);

    const answers = paper.questions.map((q: any) => ({ question_id: q.id, answer: q.answer }));
    const s = await req('POST', '/exam/submit', { paper_id: paper.id, employee_id: 'e-eng-012', answers, cert_id: certId });
    expect(s.body.data.status).toBe('SUBMITTED');
    expect(s.body.data.passed).toBeNull();
    // objective portion scored, manual pending
    expect(s.body.data.objective_score).toBeGreaterThan(0);

    const recordId = s.body.data.id;
    const manualScores = paper.questions
      .filter((q: any) => q.type === 'QA' || q.type === 'DEFENSE')
      .map((q: any) => ({ question_id: q.id, score: q.score }));
    const g = await req('POST', '/exam/grade', { record_id: recordId, manual_scores: manualScores }, { 'x-employee-id': 'e-hr' });
    expect(g.body.data.status).toBe('GRADED');
    expect(g.body.data.passed).toBe(1);

    const cert = (await req('GET', `/cert/${certId}`)).body.data;
    expect(cert.status).toBe('DEFENSE_REVIEW');
  });

  it('exam fail -> retake once -> fail again -> cert TERMINATED_EXAM_FAILED', async () => {
    const certId = await applyAndAdvanceToExam('e-eng-013');
    const paper = await makePaper('p3', true);

    const wrong = paper.questions.map((q: any) => ({ question_id: q.id, answer: 'ZZZ' }));
    const s1 = await req('POST', '/exam/submit', { paper_id: paper.id, employee_id: 'e-eng-013', answers: wrong, cert_id: certId });
    expect(s1.body.data.passed).toBe(0);
    expect(s1.body.data.is_retake).toBe(0);
    let cert = (await req('GET', `/cert/${certId}`)).body.data;
    expect(cert.status).toBe('EXAM'); // retake path
    expect(cert.retake_count).toBe(1);

    const s2 = await req('POST', '/exam/submit', { paper_id: paper.id, employee_id: 'e-eng-013', answers: wrong, cert_id: certId });
    expect(s2.body.data.passed).toBe(0);
    expect(s2.body.data.is_retake).toBe(1);
    cert = (await req('GET', `/cert/${certId}`)).body.data;
    expect(cert.status).toBe('TERMINATED_EXAM_FAILED');

    // gap generation (knowledge gap) is ticket 06 scope; here only the cert terminal state is asserted
  });
});

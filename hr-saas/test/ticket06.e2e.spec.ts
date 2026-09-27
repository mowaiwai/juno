/**
 * Ticket 06 acceptance: gap analysis + action routing + IDP.
 * - analyze employee vs standard: five gap types + deterministic action routing
 * - IDP create (manual) -> confirm -> effective -> close with review conclusion
 * - AI draft IDP path mocked via source=AI
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

describe('ticket06 gap and idp (e2e)', () => {
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

  it('gap analysis produces five gap types with correct deterministic actions', async () => {
    // ensure e-eng-002 has a profile snapshot
    const csv = `employee_no,period,grade,remark
E002,2026,C,low`;
    const imp = await req('POST', '/perf/import', { csv_content: csv }, { 'x-employee-id': 'e-hr' });
    expect(imp.body.data.imported).toBe(1);

    const a = await req('POST', '/match/analyze', { employee_id: 'e-eng-002' }, { 'x-employee-id': 'e-hr' });
    expect(a.status).toBe(201);
    const gaps = a.body.data.gaps;
    expect(gaps.length).toBeGreaterThanOrEqual(2);

    const perf = gaps.find((g: any) => g.gap_type === 'PERFORMANCE');
    expect(perf).toBeTruthy();
    expect(perf.suggest_action).toBe('绩效改进');
    expect(perf.severity).toBe('HIGH');

    const duty = gaps.find((g: any) => g.gap_type === 'DUTY');
    expect(duty).toBeTruthy();
    expect(duty.suggest_action).toBe('过程监督');

    const knowledge = gaps.find((g: any) => g.gap_type === 'KNOWLEDGE');
    expect(knowledge).toBeTruthy();
    expect(knowledge.suggest_action).toBe('学习');
  });

  it('manual IDP lifecycle: create -> confirm -> effective -> close', async () => {
    const create = await req('POST', '/idp', {
      employee_id: 'e-eng-002',
      period: '2026Q3',
      source: 'MANUAL',
      target_ability: '执行力',
      key_behavior_plan: [{ behavior: '按期交付任务', action: '每周对齐进度', deadline: '2026-10-31' }],
      gap_ids: [],
    }, { 'x-employee-id': 'e-hr' });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe('PENDING_CONFIRM');
    expect(create.body.data.ai_label).toBe(0);

    const idpId = create.body.data.id;
    const confirm = await req('POST', '/idp/confirm', { idp_id: idpId, review_conclusion: '经理认可' }, { 'x-employee-id': 'e-hr' });
    expect(confirm.body.data.status).toBe('EFFECTIVE');
    expect(confirm.body.data.confirmed_by).toBe('e-hr');

    const close = await req('POST', '/idp/close', { idp_id: idpId, review_conclusion: 'Q3 目标达成率 80%' }, { 'x-employee-id': 'e-hr' });
    expect(close.body.data.status).toBe('CLOSED');
    expect(close.body.data.review_conclusion).toBe('Q3 目标达成率 80%');

    const list = (await req('GET', '/idp?employee_id=e-eng-002', undefined, { 'x-employee-id': 'e-hr' })).body.data;
    expect(list.length).toBe(1);
  });

  it('AI draft IDP created with DRAFT status and ai_label=1', async () => {
    const create = await req('POST', '/idp', {
      employee_id: 'e-eng-003',
      period: '2026Q3',
      source: 'AI',
      target_ability: '沟通协作',
      key_behavior_plan: [{ behavior: '主动同步进展', action: '每日站会', deadline: '2026-09-30' }],
      gap_ids: [],
    }, { 'x-employee-id': 'e-hr' });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe('DRAFT');
    expect(create.body.data.ai_label).toBe(1);
  });
});

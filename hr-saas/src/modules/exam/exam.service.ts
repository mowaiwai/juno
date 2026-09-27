import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '../../common/config.service';
import { PrismaService } from '../../common/prisma.service';
import { CertService } from '../cert/cert.service';
import { LlmProvider, MOCK_LLM, scoreObjective } from './paper';

@Injectable()
export class ExamService {
  private llm: LlmProvider = MOCK_LLM; // ADR-0007: direct vendor API; MVP uses mock unless overridden
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cert: CertService,
  ) {}

  /** POST /exam/generate — AI drafts a paper for a standard; status AI_PENDING_REVIEW. */
  async generate(tenantId: string, standardId: string, operatorId: string) {
    const standard = await this.prisma.qc_standard.findFirst({
      where: { id: standardId, tenant_id: tenantId, is_deleted: 0 },
    });
    if (!standard) throw new NotFoundException('标准不存在');
    const points = await this.prisma.qc_standard_knowledge.findMany({
      where: { tenant_id: tenantId, standard_id: standardId },
      orderBy: { sort: 'asc' },
    });
    if (points.length === 0) throw new BadRequestException('该标准无知识点，无法出题');

    const drafts = await this.llm.generateQuestions(points);
    const total = drafts.reduce((s, q) => s + q.score, 0);

    const paper = await this.prisma.exam_paper.create({
      data: {
        id: randomUUID(), tenant_id: tenantId, standard_id: standardId, grade: standard.grade,
        title: `${standard.grade} 任职资格认证考试（AI 生成·待审核）`,
        source: 1, status: 'AI_PENDING_REVIEW', total_score: total,
        pass_score: await this.config.getNumber(tenantId, 'cert.exam.pass_score'),
        created_by: operatorId,
      },
    });
    await this.prisma.exam_question.createMany({
      data: drafts.map((q, i) => ({
        id: randomUUID(), tenant_id: tenantId, paper_id: paper.id, knowledge_id: q.knowledge_id,
        type: q.type, stem: q.stem, options: JSON.stringify(q.options), answer: q.answer,
        score: q.score, source: 1, sort: i,
      })),
    });
    // ADR-0009: every AI call writes ai_usage
    await this.prisma.ai_usage.create({
      data: {
        id: randomUUID(), tenant_id: tenantId, scene: 'exam_generate', model: this.llm.name,
        prompt_tokens: 0, completion_tokens: 0,
        request_summary: `standard=${standardId} points=${points.length}`,
        response_summary: `paper=${paper.id} questions=${drafts.length}`,
        desensitized: 0, // 出题输入仅含标准库内容，不涉人员数据
        created_by: operatorId,
      },
    });
    return { paper, question_count: drafts.length };
  }

  /** POST /exam/paper/review — HR approves → PUBLISHED, or discards. */
  async reviewPaper(tenantId: string, paperId: string, approve: boolean, operatorId: string) {
    const paper = await this.prisma.exam_paper.findFirst({ where: { id: paperId, tenant_id: tenantId, is_deleted: 0 } });
    if (!paper) throw new NotFoundException('试卷不存在');
    if (paper.status !== 'AI_PENDING_REVIEW') throw new BadRequestException(`当前状态 ${paper.status} 不可审核`);
    const next = approve ? 'PUBLISHED' : 'DISCARDED';
    const updated = await this.prisma.exam_paper.update({
      where: { id: paperId },
      data: { status: next, reviewed_by: operatorId, reviewed_at: new Date() },
    });
    await this.prisma.exam_question.updateMany({
      where: { tenant_id: tenantId, paper_id: paperId },
      data: { source: approve ? 2 : 1 },
    });
    return updated;
  }

  /** POST /exam/submit — employee answers; objective auto-scored; QA/DEFENSE pending manual. */
  async submit(tenantId: string, paperId: string, employeeId: string, answers: Array<{ question_id: string; answer: string }>, certId?: string) {
    const paper = await this.prisma.exam_paper.findFirst({ where: { id: paperId, tenant_id: tenantId, is_deleted: 0 } });
    if (!paper) throw new NotFoundException('试卷不存在');
    if (paper.status !== 'PUBLISHED') throw new ForbiddenException('试卷未发布，不可作答');
    const questions = await this.prisma.exam_question.findMany({ where: { tenant_id: tenantId, paper_id: paperId } });
    const byId = new Map(questions.map((q) => [q.id, q]));

    let objective = 0;
    let hasManual = false;
    const graded = answers.map((a) => {
      const q = byId.get(a.question_id);
      if (!q) return { ...a, score: 0, graded_by: 'system:unknown-question' };
      if (q.type === 'CHOICE' || q.type === 'FILL') {
        const s = scoreObjective(a.answer, q.answer) * q.score;
        objective += s;
        return { ...a, score: s, graded_by: 'system:auto' };
      }
      hasManual = true;
      return { ...a, score: null as number | null, graded_by: '' };
    });

    const existing = await this.prisma.exam_record.findFirst({
      where: { tenant_id: tenantId, paper_id: paperId, employee_id: employeeId },
    });
    const record = await this.prisma.exam_record.create({
      data: {
        id: randomUUID(), tenant_id: tenantId, paper_id: paperId, employee_id: employeeId,
        cert_id: certId ?? null, is_retake: existing ? 1 : 0,
        objective_score: objective, manual_score: hasManual ? null : 0,
        total_score: hasManual ? null : objective,
        passed: hasManual ? null : objective >= paper.pass_score ? 1 : 0,
        answers: JSON.stringify(graded), status: hasManual ? 'SUBMITTED' : 'GRADED',
        ...(hasManual ? {} : { graded_at: new Date() }),
      },
    });

    // 客观题即判：可直接回调认证闸口；含主观题则等人工评阅
    if (!hasManual && certId) {
      await this.cert.examResult(tenantId, certId, objective >= paper.pass_score, record.id, employeeId);
    }
    return record;
  }

  /** POST /exam/grade — HR grades QA/DEFENSE answers; final pass/fail + cert callback. */
  async grade(tenantId: string, recordId: string, manualScores: Array<{ question_id: string; score: number }>, operatorId: string) {
    const record = await this.prisma.exam_record.findFirst({ where: { id: recordId, tenant_id: tenantId } });
    if (!record) throw new NotFoundException('考试记录不存在');
    if (record.status === 'GRADED') throw new BadRequestException('已评阅');
    const paper = await this.prisma.exam_paper.findFirst({ where: { id: record.paper_id } });
    const answers = JSON.parse(record.answers) as Array<{ question_id: string; answer: string; score: number | null; graded_by: string }>;
    const ms = new Map(manualScores.map((m) => [m.question_id, m.score]));
    let manual = 0;
    const next = answers.map((a) => {
      if (a.score !== null) return a;
      const s = ms.get(a.question_id) ?? 0;
      manual += s;
      return { ...a, score: s, graded_by: operatorId };
    });
    const total = record.objective_score + manual;
    const passed = total >= (paper?.pass_score ?? 60) ? 1 : 0;
    const updated = await this.prisma.exam_record.update({
      where: { id: recordId },
      data: {
        answers: JSON.stringify(next), manual_score: manual, total_score: total,
        passed, status: 'GRADED', graded_at: new Date(),
      },
    });
    if (record.cert_id) {
      await this.cert.examResult(tenantId, record.cert_id, passed === 1, recordId, operatorId);
    }
    return updated;
  }

  async getPaper(tenantId: string, paperId: string) {
    const paper = await this.prisma.exam_paper.findFirst({ where: { id: paperId, tenant_id: tenantId, is_deleted: 0 } });
    if (!paper) throw new NotFoundException('试卷不存在');
    const questions = await this.prisma.exam_question.findMany({
      where: { tenant_id: tenantId, paper_id: paperId },
      orderBy: { sort: 'asc' },
    });
    return { ...paper, questions };
  }
}

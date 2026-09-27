import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '../../common/config.service';
import { PrismaService } from '../../common/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { hardCheck, PerfCondition, BasicCondition } from './hard-check';
import { panelVotePassed, ReviewRoute } from './routing';
import { CertStatus, transition, TransitionCtx } from './state-machine';

const GRADE_ORDER: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };

@Injectable()
export class CertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly profile: ProfileService,
  ) {}

  private async ctx(tenantId: string, cert: { retake_count: number; resubmit_count: number }): Promise<TransitionCtx> {
    return {
      retakeCount: cert.retake_count,
      maxRetake: await this.config.getNumber(tenantId, 'cert.exam.retake.max'),
      resubmitCount: cert.resubmit_count,
      maxResubmit: await this.config.getNumber(tenantId, 'cert.material.resubmit.max'),
    };
  }

  private async log(tenantId: string, certId: string, from: string, to: string, action: string, operatorId: string, reason = '') {
    await this.prisma.cert_audit_log.create({
      data: { id: randomUUID(), tenant_id: tenantId, cert_id: certId, from_status: from, to_status: to, action, operator_id: operatorId, reason },
    });
  }

  private async apply(tenantId: string, certId: string, event: Parameters<typeof transition>[1], operatorId: string, reason = '', extra: Record<string, any> = {}) {
    const cert = await this.prisma.cert_record.findFirst({ where: { id: certId, tenant_id: tenantId, is_deleted: 0 } });
    if (!cert) throw new NotFoundException('认证记录不存在');
    const from = cert.status as CertStatus;
    const ctx = await this.ctx(tenantId, cert);
    let to: CertStatus;
    try {
      to = transition(from, event, ctx);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
    const updated = await this.prisma.cert_record.update({
      where: { id: certId },
      data: {
        status: to, current_node: to,
        ...(to.startsWith('TERMINATED') || to === 'WITHDRAWN' || to === 'CLOSED_TIMEOUT' ? { closed_at: new Date(), terminate_reason: reason || extra.terminate_reason || '' } : {}),
        ...(to === 'EFFECTIVE' ? { effective_at: new Date() } : {}),
        ...extra,
      },
    });
    await this.log(tenantId, certId, from, to, event, operatorId, reason);
    if (to === 'EFFECTIVE') {
      await this.profile.buildProfile(tenantId, cert.employee_id, 'cert_effective');
    }
    return updated;
  }

  /** POST /cert/apply — 发起认证申请，触发硬校验。 */
  async applyFor(tenantId: string, employeeId: string, operatorId: string) {
    const emp = await this.prisma.org_employee.findFirst({ where: { id: employeeId, tenant_id: tenantId, is_deleted: 0 } });
    if (!emp) throw new NotFoundException('员工不存在');
    const currentOrder = GRADE_ORDER[emp.grade];
    if (!currentOrder || currentOrder >= 5) throw new BadRequestException(`当前职级 ${emp.grade} 无更高认证目标`);

    const targetGrade = `P${currentOrder + 1}`;
    const channel = await this.prisma.qc_channel.findFirst({ where: { tenant_id: tenantId, grade: targetGrade, is_deleted: 0 } });
    if (!channel) throw new BadRequestException(`目标职级 ${targetGrade} 未配置通道`);
    const standard = await this.prisma.qc_standard.findFirst({
      where: { tenant_id: tenantId, channel_id: channel.id, status: 1, is_deleted: 0 },
    });
    if (!standard) throw new BadRequestException(`目标职级 ${targetGrade} 无生效标准`);

    const dup = await this.prisma.cert_record.findFirst({
      where: {
        tenant_id: tenantId, employee_id: employeeId, is_deleted: 0,
        status: { in: ['INITIATED', 'MATERIAL_REVIEW', 'MATERIAL_RETURNED', 'EXAM', 'DEFENSE_REVIEW'] },
      },
    });
    if (dup) throw new BadRequestException('已有进行中的认证申请');

    // hard check
    const applyYear = new Date().getFullYear();
    const perfs = await this.prisma.perf_result.findMany({
      where: { tenant_id: tenantId, employee_id: employeeId, is_deleted: 0 },
      select: { period: true, grade: true },
    });
    const basic: BasicCondition = JSON.parse(standard.basic_condition || '{}');
    const perf: PerfCondition = JSON.parse(standard.perf_condition || '{}');
    const check = hardCheck(basic, perf, { education: emp.education, hire_date: emp.hire_date }, perfs, applyYear);

    const route = (await this.config.get(tenantId, `cert.route.${targetGrade.toLowerCase()}`)) as ReviewRoute;
    const cert = await this.prisma.cert_record.create({
      data: {
        id: randomUUID(), tenant_id: tenantId, employee_id: employeeId, channel_id: channel.id,
        from_grade: emp.grade, to_grade: targetGrade, status: 'INITIATED', current_node: 'INITIATED',
        review_route: route, created_by: operatorId,
      },
    });
    await this.log(tenantId, cert.id, '', 'INITIATED', 'apply', operatorId);

    const next = await this.apply(
      tenantId, cert.id,
      check.pass ? 'hard_check_pass' : 'hard_check_fail',
      operatorId,
      check.pass ? '' : check.reasons.join('; '),
      { terminate_reason: check.pass ? '' : check.reasons.join('; ') },
    );
    return { cert: next, auto_check: { pass: check.pass, reasons: check.reasons } };
  }

  /** POST /cert/material — submit evidence materials. */
  async submitMaterial(tenantId: string, certId: string, materials: any[], operatorId: string) {
    const cert = await this.prisma.cert_record.findFirst({ where: { id: certId, tenant_id: tenantId, is_deleted: 0 } });
    if (!cert) throw new NotFoundException('认证记录不存在');
    if (cert.status === 'MATERIAL_RETURNED') {
      const updated = await this.apply(tenantId, certId, 'material_resubmit', operatorId, '', {
        materials: JSON.stringify(materials), resubmit_count: cert.resubmit_count + 1,
      });
      return updated;
    }
    return this.prisma.cert_record.update({ where: { id: certId }, data: { materials: JSON.stringify(materials) } });
  }

  /** POST /cert/review — 评审表决 (按路由). */
  async review(tenantId: string, certId: string, voterId: string, approve: boolean, comment: string) {
    const cert = await this.prisma.cert_record.findFirst({ where: { id: certId, tenant_id: tenantId, is_deleted: 0 } });
    if (!cert) throw new NotFoundException('认证记录不存在');
    if (cert.status !== 'DEFENSE_REVIEW') throw new BadRequestException(`当前状态 ${cert.status} 不可评审`);
    const voter = await this.prisma.org_employee.findFirst({ where: { id: voterId, tenant_id: tenantId, is_deleted: 0 } });
    if (!voter) throw new NotFoundException('评审人不存在');

    const route = cert.review_route as ReviewRoute;
    if (route === 'MANAGER_SINGLE' && voter.role !== 'MANAGER' && voter.role !== 'HR' && voter.role !== 'EXEC') {
      throw new ForbiddenException('部门经理单审需经理及以上角色');
    }
    if (route === 'PANEL_VOTE' && !['MANAGER', 'HR', 'EXEC'].includes(voter.role)) {
      throw new ForbiddenException('小组表决需经理/HR/高管');
    }
    if (route === 'COMMITTEE_FINAL' && !['HR', 'EXEC'].includes(voter.role)) {
      throw new ForbiddenException('管委会终审需 HR/高管');
    }

    await this.prisma.cert_review_vote.upsert({
      where: { tenant_id_cert_id_voter_id: { tenant_id: tenantId, cert_id: certId, voter_id: voterId } },
      update: { approve: approve ? 1 : 0 },
      create: { id: randomUUID(), tenant_id: tenantId, cert_id: certId, voter_id: voterId, approve: approve ? 1 : 0, role: voter.role },
    });

    let passed = false;
    if (route === 'MANAGER_SINGLE') {
      passed = approve; // single reviewer decides immediately
    } else if (route === 'PANEL_VOTE') {
      const votes = await this.prisma.cert_review_vote.findMany({ where: { tenant_id: tenantId, cert_id: certId } });
      const ratio = await this.config.getNumber(tenantId, 'cert.panel.pass_ratio');
      passed = panelVotePassed(votes.map((v) => ({ voter_id: v.voter_id, approve: v.approve === 1 })), ratio);
    } else {
      passed = approve; // COMMITTEE_FINAL: MVP single final approver
    }

    const next = await this.apply(tenantId, certId, passed ? 'defense_pass' : 'defense_fail', voterId, comment, {
      terminate_reason: passed ? '' : comment,
    });
    return { cert: next, passed, comment };
  }

  /** Withdraw by employee. */
  async withdraw(tenantId: string, certId: string, operatorId: string, reason: string) {
    return this.apply(tenantId, certId, 'withdraw', operatorId, reason, { terminate_reason: reason });
  }

  /** Batch timeout (called by scheduler / manual trigger). */
  async timeout(tenantId: string, certId: string, operatorId: string) {
    return this.apply(tenantId, certId, 'timeout', operatorId, '批次超时自动关闭', { terminate_reason: '批次超时自动关闭' });
  }

  /** Material预审 (HR). */
  async materialReview(tenantId: string, certId: string, approve: boolean, operatorId: string, reason: string) {
    return this.apply(tenantId, certId, approve ? 'material_approve' : 'material_reject', operatorId, reason);
  }

  /** Exam gate callback from exam module. */
  async examResult(tenantId: string, certId: string, passed: boolean, examRecordId: string, operatorId: string) {
    const cert = await this.prisma.cert_record.findFirst({ where: { id: certId, tenant_id: tenantId } });
    if (!cert) throw new NotFoundException('认证记录不存在');
    const extra: Record<string, any> = { exam_record_id: examRecordId };
    if (!passed && cert.status === 'EXAM' && cert.retake_count < (await this.config.getNumber(tenantId, 'cert.exam.retake.max'))) {
      extra.retake_count = cert.retake_count + 1;
    }
    return this.apply(tenantId, certId, passed ? 'exam_pass' : 'exam_fail', operatorId, '', extra);
  }

  async detail(tenantId: string, certId: string) {
    const cert = await this.prisma.cert_record.findFirst({ where: { id: certId, tenant_id: tenantId, is_deleted: 0 } });
    if (!cert) throw new NotFoundException('认证记录不存在');
    const [logs, votes] = await Promise.all([
      this.prisma.cert_audit_log.findMany({ where: { tenant_id: tenantId, cert_id: certId }, orderBy: { created_at: 'asc' } }),
      this.prisma.cert_review_vote.findMany({ where: { tenant_id: tenantId, cert_id: certId } }),
    ]);
    return { ...cert, audit_logs: logs, votes };
  }

  async listByEmployee(tenantId: string, employeeId: string) {
    return this.prisma.cert_record.findMany({
      where: { tenant_id: tenantId, employee_id: employeeId, is_deleted: 0 },
      orderBy: { created_at: 'desc' },
    });
  }
}

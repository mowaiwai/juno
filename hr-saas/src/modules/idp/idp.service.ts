import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class IdpService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /idp — create IDP (manual or AI draft). */
  async create(
    tenantId: string,
    employeeId: string,
    period: string,
    source: 'AI' | 'MANUAL',
    targetAbility: string,
    keyBehaviorPlan: Array<{ behavior: string; action: string; deadline: string }>,
    gapIds: string[],
    operatorId: string,
  ) {
    const emp = await this.prisma.org_employee.findFirst({
      where: { id: employeeId, tenant_id: tenantId, is_deleted: 0 },
    });
    if (!emp) throw new NotFoundException('员工不存在');

    // MVP: one IDP per employee per period
    const existing = await this.prisma.idp.findFirst({
      where: { tenant_id: tenantId, employee_id: employeeId, period, is_deleted: 0 },
    });
    if (existing) throw new BadRequestException(`该员工 ${period} 已有 IDP`);

    const aiLabel = source === 'AI' ? 1 : 0;
    return this.prisma.idp.create({
      data: {
        id: randomUUID(), tenant_id: tenantId, employee_id: employeeId, period,
        source: source === 'AI' ? 1 : 2, status: source === 'AI' ? 'DRAFT' : 'PENDING_CONFIRM',
        target_ability: targetAbility,
        key_behavior_plan: JSON.stringify(keyBehaviorPlan),
        gap_ids: JSON.stringify(gapIds),
        ai_label: aiLabel,
        created_by: operatorId,
      },
    });
  }

  /** POST /idp/confirm — human confirms AI draft or manual IDP. */
  async confirm(tenantId: string, idpId: string, reviewConclusion: string, operatorId: string) {
    const idp = await this.prisma.idp.findFirst({ where: { id: idpId, tenant_id: tenantId, is_deleted: 0 } });
    if (!idp) throw new NotFoundException('IDP 不存在');
    if (idp.status !== 'DRAFT' && idp.status !== 'PENDING_CONFIRM') {
      throw new BadRequestException(`当前状态 ${idp.status} 不可确认`);
    }
    return this.prisma.idp.update({
      where: { id: idpId },
      data: {
        status: 'EFFECTIVE',
        review_conclusion: reviewConclusion,
        confirmed_by: operatorId,
        confirmed_at: new Date(),
      },
    });
  }

  /** POST /idp/close — close an effective IDP with review conclusion. */
  async close(tenantId: string, idpId: string, reviewConclusion: string, operatorId: string) {
    const idp = await this.prisma.idp.findFirst({ where: { id: idpId, tenant_id: tenantId, is_deleted: 0 } });
    if (!idp) throw new NotFoundException('IDP 不存在');
    if (idp.status !== 'EFFECTIVE') throw new BadRequestException(`当前状态 ${idp.status} 不可关闭`);
    return this.prisma.idp.update({
      where: { id: idpId },
      data: { status: 'CLOSED', review_conclusion: reviewConclusion, confirmed_by: operatorId, confirmed_at: new Date() },
    });
  }

  /** GET /idp?employee_id= — list. */
  async listByEmployee(tenantId: string, employeeId: string) {
    const rows = await this.prisma.idp.findMany({
      where: { tenant_id: tenantId, employee_id: employeeId, is_deleted: 0 },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      key_behavior_plan: JSON.parse(r.key_behavior_plan || '[]'),
      gap_ids: JSON.parse(r.gap_ids || '[]'),
    }));
  }
}

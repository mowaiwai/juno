import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { analyzeGaps, routeAction } from './gap';

@Injectable()
export class GapService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /match/analyze — compare employee against target-grade standard, produce gaps. */
  async analyze(tenantId: string, employeeId: string, targetGrade?: string) {
    const emp = await this.prisma.org_employee.findFirst({
      where: { id: employeeId, tenant_id: tenantId, is_deleted: 0 },
    });
    if (!emp) throw new NotFoundException('员工不存在');

    // target grade: explicit, or next level up
    const gradeOrder: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
    const target = targetGrade ?? `P${(gradeOrder[emp.grade] ?? 0) + 1}`;
    const channel = await this.prisma.qc_channel.findFirst({
      where: { tenant_id: tenantId, grade: target, is_deleted: 0 },
    });
    if (!channel) throw new NotFoundException(`目标职级 ${target} 无通道`);

    const standard = await this.prisma.qc_standard.findFirst({
      where: { tenant_id: tenantId, channel_id: channel.id, status: 1, is_deleted: 0 },
    });
    if (!standard) throw new NotFoundException(`目标职级 ${target} 无生效标准`);

    const [duties, abilities, knowledge, profile] = await Promise.all([
      this.prisma.qc_standard_duty.findMany({ where: { tenant_id: tenantId, standard_id: standard.id } }),
      this.prisma.qc_standard_ability.findMany({ where: { tenant_id: tenantId, standard_id: standard.id } }),
      this.prisma.qc_standard_knowledge.findMany({ where: { tenant_id: tenantId, standard_id: standard.id } }),
      this.prisma.profile_snapshot.findFirst({
        where: { tenant_id: tenantId, employee_id: employeeId, is_current: 1 },
        orderBy: [{ period: 'desc' }, { version: 'desc' }],
      }),
    ]);

    const profileData = profile ? JSON.parse(profile.dimension_data) : {
      perf_summary: { latest_grade: '' },
      duty: { cert_status: '' },
      knowledge: { exam_passed: false },
      ability: { abilities: [] },
      team_contrib: { role: '' },
    };

    const gaps = analyzeGaps(
      {
        perf_condition: JSON.parse(standard.perf_condition || '{}'),
        duties: duties.map((d) => ({ duty_item: d.duty_item, duty_level: d.duty_level })),
        abilities: abilities.map((a) => ({ ability_item: a.ability_item })),
        knowledge: knowledge.map((k) => ({ knowledge_point: k.knowledge_point, mastery_level: k.mastery_level })),
      },
      profileData,
    );

    // clear old OPEN gaps for this employee+standard, then insert new ones
    await this.prisma.gap_analysis.deleteMany({
      where: { tenant_id: tenantId, employee_id: employeeId, standard_id: standard.id, status: 'OPEN' },
    });

    const created = await Promise.all(
      gaps.map((g) =>
        this.prisma.gap_analysis.create({
          data: {
            id: randomUUID(), tenant_id: tenantId, employee_id: employeeId,
            standard_id: standard.id, gap_type: g.gap_type, gap_detail: g.gap_detail,
            severity: g.severity, suggest_action: routeAction(g.gap_type), status: 'OPEN',
          },
        }),
      ),
    );

    return { employee_id: employeeId, standard_id: standard.id, target_grade: target, gaps: created };
  }

  /** GET /match/gaps?employee_id= — list gaps. */
  async listByEmployee(tenantId: string, employeeId: string) {
    return this.prisma.gap_analysis.findMany({
      where: { tenant_id: tenantId, employee_id: employeeId },
      orderBy: { created_at: 'desc' },
    });
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { buildDimensionData, canViewProfile } from './profile';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build or version a profile snapshot for an employee.
   * trigger_source: perf_import | cert_effective
   */
  async buildProfile(tenantId: string, employeeId: string, triggerSource: 'perf_import' | 'cert_effective') {
    const emp = await this.prisma.org_employee.findFirst({
      where: { id: employeeId, tenant_id: tenantId, is_deleted: 0 },
    });
    if (!emp) throw new NotFoundException('员工不存在');

    const perfs = await this.prisma.perf_result.findMany({
      where: { tenant_id: tenantId, employee_id: employeeId, is_deleted: 0 },
      select: { period: true, grade: true },
      orderBy: { period: 'asc' },
    });

    const latestCert = await this.prisma.cert_record.findFirst({
      where: { tenant_id: tenantId, employee_id: employeeId, is_deleted: 0, status: 'EFFECTIVE' },
      orderBy: { effective_at: 'desc' },
      select: { status: true, to_grade: true },
    });

    const latestExam = await this.prisma.exam_record.findFirst({
      where: { tenant_id: tenantId, employee_id: employeeId },
      orderBy: { created_at: 'desc' },
      select: { passed: true },
    });

    // 认证生效的等级优先于主数据（current_grade 反映最新认证结果）
    const currentGrade = latestCert?.to_grade ?? emp.grade;

    const dim = buildDimensionData(
      { education: emp.education, hire_date: emp.hire_date, grade: currentGrade },
      perfs,
      latestExam,
      latestCert,
    );

    // period: use current year+quarter as snapshot period
    const now = new Date();
    const period = `${now.getFullYear()}Q${Math.ceil((now.getMonth() + 1) / 3)}`;

    // flip existing is_current
    await this.prisma.profile_snapshot.updateMany({
      where: { tenant_id: tenantId, employee_id: employeeId, period, is_current: 1 },
      data: { is_current: 0 },
    });

    // version: max+1 within (tenant, employee, period)
    const max = await this.prisma.profile_snapshot.aggregate({
      where: { tenant_id: tenantId, employee_id: employeeId, period },
      _max: { version: true },
    });
    const version = (max._max.version ?? 0) + 1;

    return this.prisma.profile_snapshot.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        employee_id: employeeId,
        period,
        version,
        current_grade: currentGrade,
        dimension_data: JSON.stringify(dim),
        trigger_source: triggerSource,
        is_current: 1,
        created_by: 'system',
      },
    });
  }

  /** All snapshots for an employee, ordered latest-first. */
  async listVersions(tenantId: string, employeeId: string) {
    return this.prisma.profile_snapshot.findMany({
      where: { tenant_id: tenantId, employee_id: employeeId },
      orderBy: [{ period: 'desc' }, { version: 'desc' }],
    });
  }

  /** GET /profile/:employee_id — current snapshot + version list, with role mask. */
  async getProfile(tenantId: string, viewerId: string, targetEmployeeId: string) {
    const viewer = await this.prisma.org_employee.findFirst({
      where: { id: viewerId, tenant_id: tenantId, is_deleted: 0 },
      select: { id: true, role: true },
    });
    if (!viewer) throw new NotFoundException('查看者不存在');

    const target = await this.prisma.org_employee.findFirst({
      where: { id: targetEmployeeId, tenant_id: tenantId, is_deleted: 0 },
      select: { id: true, name: true, manager_id: true },
    });
    if (!target) throw new NotFoundException('员工不存在');

    const isDirectReport = target.manager_id === viewerId;
    if (!canViewProfile(viewer.role, viewerId, targetEmployeeId, isDirectReport)) {
      throw new ForbiddenException('无权查看该员工画像');
    }

    const current = await this.prisma.profile_snapshot.findFirst({
      where: { tenant_id: tenantId, employee_id: targetEmployeeId, is_current: 1 },
      orderBy: [{ period: 'desc' }, { version: 'desc' }],
    });

    const versions = await this.listVersions(tenantId, targetEmployeeId);

    return {
      employee: target,
      current: current ? { ...current, dimension_data: JSON.parse(current.dimension_data) } : null,
      versions: versions.map((v) => ({ period: v.period, version: v.version, trigger_source: v.trigger_source, is_current: v.is_current === 1 })),
    };
  }
}

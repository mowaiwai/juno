import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { parsePerfCsv } from './csv';

export interface ImportResult {
  batch: string;
  imported: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class PerfService {
  constructor(private readonly prisma: PrismaService, private readonly profile: ProfileService) {}

  async importCsv(tenantId: string, csvContent: string, actor: string): Promise<ImportResult> {
    const { rows, errors } = parsePerfCsv(csvContent);
    if (rows.length === 0 && errors.length > 0) {
      throw new BadRequestException(`CSV 解析失败: ${errors.join('; ')}`);
    }
    const batch = randomUUID();
    let imported = 0;
    let skipped = 0;
    const rowErrors: string[] = [...errors];

    const employees = await this.prisma.org_employee.findMany({
      where: { tenant_id: tenantId, is_deleted: 0 },
      select: { id: true, employee_no: true },
    });
    const byNo = new Map(employees.map((e) => [e.employee_no, e.id]));

    for (const row of rows) {
      const empId = byNo.get(row.employee_no);
      if (!empId) {
        rowErrors.push(`${row.employee_no}: 员工不存在`);
        skipped++;
        continue;
      }
      await this.prisma.perf_result.upsert({
        where: { tenant_id_employee_id_period: { tenant_id: tenantId, employee_id: empId, period: row.period } },
        update: { grade: row.grade, remark: row.remark, source: 1, import_batch: batch, created_by: actor },
        create: {
          id: randomUUID(), tenant_id: tenantId, employee_id: empId, period: row.period,
          grade: row.grade, remark: row.remark, source: 1, import_batch: batch, created_by: actor,
        },
      });
      imported++;
    }

    // ADR-0005: perf import triggers profile snapshot for affected employees
    const touched = [...new Set(rows.filter((r) => byNo.has(r.employee_no)).map((r) => byNo.get(r.employee_no)!))];
    await Promise.all(touched.map((eid) => this.profile.buildProfile(tenantId, eid, 'perf_import')));

    return { batch, imported, skipped, errors: rowErrors };
  }

  async listByEmployee(tenantId: string, employeeId: string) {
    return this.prisma.perf_result.findMany({
      where: { tenant_id: tenantId, employee_id: employeeId, is_deleted: 0 },
      orderBy: { period: 'asc' },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  /** Employee detail with department path (root->leaf), position, grade, 2-year perf. */
  async employeeDetail(tenantId: string, employeeId: string) {
    const emp = await this.prisma.org_employee.findFirst({
      where: { id: employeeId, tenant_id: tenantId, is_deleted: 0 },
    });
    if (!emp) return null;
    const [depts, position, perfs, manager] = await Promise.all([
      this.prisma.org_department.findMany({ where: { tenant_id: tenantId, is_deleted: 0 } }),
      this.prisma.org_position.findFirst({ where: { id: emp.position_id, tenant_id: tenantId } }),
      this.prisma.perf_result.findMany({
        where: { tenant_id: tenantId, employee_id: emp.id, is_deleted: 0 },
        orderBy: { period: 'asc' },
      }),
      emp.manager_id
        ? this.prisma.org_employee.findFirst({ where: { id: emp.manager_id, tenant_id: tenantId } })
        : Promise.resolve(null),
    ]);
    const byId = new Map(depts.map((d) => [d.id, d]));
    const path: string[] = [];
    let cur = byId.get(emp.dept_id);
    while (cur) {
      path.unshift(cur.name);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return {
      ...emp,
      dept_path: path,
      position_name: position?.name ?? null,
      manager_name: manager?.name ?? null,
      perf_results: perfs,
    };
  }

  /** Ids of all departments in the subtree rooted at deptId (inclusive). */
  async deptSubtreeIds(tenantId: string, deptId: string): Promise<string[]> {
    const depts = await this.prisma.org_department.findMany({
      where: { tenant_id: tenantId, is_deleted: 0 },
      select: { id: true, parent_id: true },
    });
    const children = new Map<string | null, string[]>();
    for (const d of depts) {
      const list = children.get(d.parent_id) ?? [];
      list.push(d.id);
      children.set(d.parent_id, list);
    }
    const out: string[] = [];
    const stack = [deptId];
    while (stack.length) {
      const id = stack.pop()!;
      out.push(id);
      for (const c of children.get(id) ?? []) stack.push(c);
    }
    return out;
  }
}

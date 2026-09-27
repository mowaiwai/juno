import { Controller, Get, Headers, Param } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TENANT_CODE, resolveTenantId } from '../../common/tenant';

@Controller('channel')
export class ChannelController {
  constructor(private readonly prisma: PrismaService) {}

  private async tenantId(headers: Record<string, any>) {
    const t = await this.prisma.tenant.findUnique({ where: { code: DEFAULT_TENANT_CODE } });
    return resolveTenantId(headers, t?.id ?? 't-demo');
  }

  @Get()
  async list(@Headers() headers: Record<string, any>) {
    const tid = await this.tenantId(headers);
    return this.prisma.qc_channel.findMany({
      where: { tenant_id: tid, is_deleted: 0 },
      orderBy: { grade_order: 'asc' },
    });
  }

  @Get(':id/standard')
  async standard(@Param('id') id: string, @Headers() headers: Record<string, any>) {
    const tid = await this.tenantId(headers);
    const std = await this.prisma.qc_standard.findFirst({
      where: { tenant_id: tid, channel_id: id, status: 1, is_deleted: 0 },
    });
    if (!std) return null;
    const [dutyCount, knowledgeCount] = await Promise.all([
      this.prisma.qc_standard_duty.count({ where: { tenant_id: tid, standard_id: std.id } }),
      this.prisma.qc_standard_knowledge.count({ where: { tenant_id: tid, standard_id: std.id } }),
    ]);
    return {
      ...std,
      basic_condition: JSON.parse(std.basic_condition || '{}'),
      perf_condition: JSON.parse(std.perf_condition || '{}'),
      duty_count: dutyCount,
      knowledge_count: knowledgeCount,
    };
  }
}

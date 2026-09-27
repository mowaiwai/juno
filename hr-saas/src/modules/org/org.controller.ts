import { Controller, Get, Headers, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TENANT_CODE, resolveTenantId } from '../../common/tenant';
import { OrgService } from './org.service';

@Controller('org')
export class OrgController {
  constructor(private readonly org: OrgService, private readonly prisma: PrismaService) {}

  @Get('employee/:id')
  async detail(@Param('id') id: string, @Headers() headers: Record<string, any>) {
    const t = await this.prisma.tenant.findUnique({ where: { code: DEFAULT_TENANT_CODE } });
    const tenantId = resolveTenantId(headers, t?.id ?? 't-demo');
    const data = await this.org.employeeDetail(tenantId, id);
    if (!data) throw new NotFoundException('员工不存在');
    return data;
  }
}

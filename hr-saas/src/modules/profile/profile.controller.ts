import { Controller, Get, Headers, Param } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TENANT_CODE, resolveActorId, resolveTenantId } from '../../common/tenant';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService, private readonly prisma: PrismaService) {}

  private async tenantId(headers: Record<string, any>) {
    const t = await this.prisma.tenant.findUnique({ where: { code: DEFAULT_TENANT_CODE } });
    return resolveTenantId(headers, t?.id ?? 't-demo');
  }

  @Get(':employee_id')
  async getProfile(@Param('employee_id') employeeId: string, @Headers() headers: Record<string, any>) {
    const viewerId = resolveActorId(headers);
    return this.profile.getProfile(await this.tenantId(headers), viewerId, employeeId);
  }
}

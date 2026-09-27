import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TENANT_CODE, resolveActorId, resolveTenantId } from '../../common/tenant';
import { PerfService } from './perf.service';

class ImportDto {
  @IsString()
  csv_content: string;
}

@Controller('perf')
export class PerfController {
  constructor(private readonly perf: PerfService, private readonly prisma: PrismaService) {}

  private async tenantId(headers: Record<string, any>) {
    const t = await this.prisma.tenant.findUnique({ where: { code: DEFAULT_TENANT_CODE } });
    return resolveTenantId(headers, t?.id ?? 't-demo');
  }

  @Post('import')
  async importCsv(@Body() dto: ImportDto, @Headers() headers: Record<string, any>) {
    const tenantId = await this.tenantId(headers);
    return this.perf.importCsv(tenantId, dto.csv_content, resolveActorId(headers));
  }

  @Get('employee/:id')
  async list(@Param('id') id: string, @Headers() headers: Record<string, any>) {
    return this.perf.listByEmployee(await this.tenantId(headers), id);
  }
}

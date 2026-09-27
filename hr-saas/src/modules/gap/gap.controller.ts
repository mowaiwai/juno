import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TENANT_CODE, resolveTenantId } from '../../common/tenant';
import { GapService } from './gap.service';

class AnalyzeDto {
  @IsString()
  employee_id: string;
  @IsString()
  @IsOptional()
  target_grade?: string;
}

@Controller('match')
export class GapController {
  constructor(private readonly gap: GapService, private readonly prisma: PrismaService) {}

  private async tenantId(headers: Record<string, any>) {
    const t = await this.prisma.tenant.findUnique({ where: { code: DEFAULT_TENANT_CODE } });
    return resolveTenantId(headers, t?.id ?? 't-demo');
  }

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeDto, @Headers() headers: Record<string, any>) {
    return this.gap.analyze(await this.tenantId(headers), dto.employee_id, dto.target_grade);
  }

  @Get('gaps')
  async list(@Query('employee_id') employeeId: string, @Headers() headers: Record<string, any>) {
    return this.gap.listByEmployee(await this.tenantId(headers), employeeId);
  }
}

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TENANT_CODE, resolveActorId, resolveTenantId } from '../../common/tenant';
import { IdpService } from './idp.service';

class CreateIdpDto {
  @IsString()
  employee_id: string;
  @IsString()
  period: string; // e.g. 2026Q3
  @IsIn(['AI', 'MANUAL'])
  source: 'AI' | 'MANUAL';
  @IsString()
  target_ability: string;
  @IsArray()
  key_behavior_plan: Array<{ behavior: string; action: string; deadline: string }>;
  @IsArray()
  gap_ids: string[];
}
class ConfirmIdpDto {
  @IsString()
  idp_id: string;
  @IsString()
  @IsOptional()
  review_conclusion: string = '';
}
class CloseIdpDto {
  @IsString()
  idp_id: string;
  @IsString()
  @IsOptional()
  review_conclusion: string = '';
}

@Controller('idp')
export class IdpController {
  constructor(private readonly idp: IdpService, private readonly prisma: PrismaService) {}

  private async tenantId(headers: Record<string, any>) {
    const t = await this.prisma.tenant.findUnique({ where: { code: DEFAULT_TENANT_CODE } });
    return resolveTenantId(headers, t?.id ?? 't-demo');
  }

  @Post()
  async create(@Body() dto: CreateIdpDto, @Headers() headers: Record<string, any>) {
    return this.idp.create(
      await this.tenantId(headers),
      dto.employee_id,
      dto.period,
      dto.source,
      dto.target_ability,
      dto.key_behavior_plan,
      dto.gap_ids,
      resolveActorId(headers),
    );
  }

  @Post('confirm')
  async confirm(@Body() dto: ConfirmIdpDto, @Headers() headers: Record<string, any>) {
    return this.idp.confirm(await this.tenantId(headers), dto.idp_id, dto.review_conclusion, resolveActorId(headers));
  }

  @Post('close')
  async close(@Body() dto: CloseIdpDto, @Headers() headers: Record<string, any>) {
    return this.idp.close(await this.tenantId(headers), dto.idp_id, dto.review_conclusion, resolveActorId(headers));
  }

  @Get()
  async list(@Query('employee_id') employeeId: string, @Headers() headers: Record<string, any>) {
    return this.idp.listByEmployee(await this.tenantId(headers), employeeId);
  }
}

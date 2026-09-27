import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TENANT_CODE, resolveActorId, resolveTenantId } from '../../common/tenant';
import { CertService } from './cert.service';

class ApplyDto {
  @IsString()
  employee_id: string;
}
class ReviewDto {
  @IsString()
  cert_id: string;
  @IsString()
  voter_id: string;
  @IsBoolean()
  approve: boolean;
  @IsString()
  @IsOptional()
  comment: string = '';
}
class MaterialDto {
  @IsString()
  cert_id: string;
  materials: any[];
}
class MaterialReviewDto {
  @IsString()
  cert_id: string;
  @IsBoolean()
  approve: boolean;
  @IsString()
  @IsOptional()
  reason: string = '';
}
class WithdrawDto {
  @IsString()
  cert_id: string;
  @IsString()
  @IsOptional()
  reason: string = '';
}
class TimeoutDto {
  @IsString()
  cert_id: string;
}

@Controller('cert')
export class CertController {
  constructor(private readonly cert: CertService, private readonly prisma: PrismaService) {}

  private async tenantId(headers: Record<string, any>) {
    const t = await this.prisma.tenant.findUnique({ where: { code: DEFAULT_TENANT_CODE } });
    return resolveTenantId(headers, t?.id ?? 't-demo');
  }

  @Post('apply')
  async apply(@Body() dto: ApplyDto, @Headers() headers: Record<string, any>) {
    return this.cert.applyFor(await this.tenantId(headers), dto.employee_id, resolveActorId(headers));
  }

  @Post('material')
  async material(@Body() dto: MaterialDto, @Headers() headers: Record<string, any>) {
    return this.cert.submitMaterial(await this.tenantId(headers), dto.cert_id, dto.materials, resolveActorId(headers));
  }

  @Post('material/review')
  async materialReview(@Body() dto: MaterialReviewDto, @Headers() headers: Record<string, any>) {
    return this.cert.materialReview(await this.tenantId(headers), dto.cert_id, dto.approve, resolveActorId(headers), dto.reason);
  }

  @Post('review')
  async review(@Body() dto: ReviewDto, @Headers() headers: Record<string, any>) {
    return this.cert.review(await this.tenantId(headers), dto.cert_id, dto.voter_id, dto.approve, dto.comment);
  }

  @Post('withdraw')
  async withdraw(@Body() dto: WithdrawDto, @Headers() headers: Record<string, any>) {
    return this.cert.withdraw(await this.tenantId(headers), dto.cert_id, resolveActorId(headers), dto.reason);
  }

  @Post('timeout')
  async timeout(@Body() dto: TimeoutDto, @Headers() headers: Record<string, any>) {
    return this.cert.timeout(await this.tenantId(headers), dto.cert_id, resolveActorId(headers));
  }

  @Get('employee/:id')
  async list(@Param('id') id: string, @Headers() headers: Record<string, any>) {
    return this.cert.listByEmployee(await this.tenantId(headers), id);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Headers() headers: Record<string, any>) {
    return this.cert.detail(await this.tenantId(headers), id);
  }
}

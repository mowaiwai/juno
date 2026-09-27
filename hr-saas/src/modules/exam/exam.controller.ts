import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TENANT_CODE, resolveActorId, resolveTenantId } from '../../common/tenant';
import { ExamService } from './exam.service';

class GenerateDto {
  @IsString()
  standard_id: string;
}
class PaperReviewDto {
  @IsString()
  paper_id: string;
  @IsBoolean()
  approve: boolean;
}
class SubmitDto {
  @IsString()
  paper_id: string;
  @IsString()
  employee_id: string;
  @IsArray()
  answers: Array<{ question_id: string; answer: string }>;
  @IsString()
  @IsOptional()
  cert_id?: string;
}
class GradeDto {
  @IsString()
  record_id: string;
  @IsArray()
  manual_scores: Array<{ question_id: string; score: number }>;
}

@Controller('exam')
export class ExamController {
  constructor(private readonly exam: ExamService, private readonly prisma: PrismaService) {}

  private async tenantId(headers: Record<string, any>) {
    const t = await this.prisma.tenant.findUnique({ where: { code: DEFAULT_TENANT_CODE } });
    return resolveTenantId(headers, t?.id ?? 't-demo');
  }

  @Post('generate')
  async generate(@Body() dto: GenerateDto, @Headers() headers: Record<string, any>) {
    return this.exam.generate(await this.tenantId(headers), dto.standard_id, resolveActorId(headers));
  }

  @Post('paper/review')
  async reviewPaper(@Body() dto: PaperReviewDto, @Headers() headers: Record<string, any>) {
    return this.exam.reviewPaper(await this.tenantId(headers), dto.paper_id, dto.approve, resolveActorId(headers));
  }

  @Post('submit')
  async submit(@Body() dto: SubmitDto, @Headers() headers: Record<string, any>) {
    return this.exam.submit(await this.tenantId(headers), dto.paper_id, dto.employee_id, dto.answers, dto.cert_id);
  }

  @Post('grade')
  async grade(@Body() dto: GradeDto, @Headers() headers: Record<string, any>) {
    return this.exam.grade(await this.tenantId(headers), dto.record_id, dto.manual_scores, resolveActorId(headers));
  }

  @Get('paper/:id')
  async getPaper(@Param('id') id: string, @Headers() headers: Record<string, any>) {
    return this.exam.getPaper(await this.tenantId(headers), id);
  }
}

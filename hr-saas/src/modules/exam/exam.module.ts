import { Module } from '@nestjs/common';
import { ConfigService } from '../../common/config.service';
import { PrismaService } from '../../common/prisma.service';
import { CertModule } from '../cert/cert.module';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';

@Module({
  imports: [CertModule],
  controllers: [ExamController],
  providers: [ExamService, PrismaService, ConfigService],
  exports: [ExamService],
})
export class ExamModule {}

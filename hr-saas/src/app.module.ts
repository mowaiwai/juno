import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { PerfModule } from './modules/perf/perf.module';
import { OrgModule } from './modules/org/org.module';
import { CertModule } from './modules/cert/cert.module';
import { ExamModule } from './modules/exam/exam.module';
import { ProfileModule } from './modules/profile/profile.module';
import { GapModule } from './modules/gap/gap.module';
import { IdpModule } from './modules/idp/idp.module';
import { ChannelModule } from './modules/channel/channel.module';

@Module({
  imports: [AuthModule, PerfModule, OrgModule, CertModule, ExamModule, ProfileModule, GapModule, IdpModule, ChannelModule],
  providers: [PrismaService],
})
export class AppModule {}

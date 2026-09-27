import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ProfileModule } from '../profile/profile.module';
import { PerfController } from './perf.controller';
import { PerfService } from './perf.service';

@Module({
  imports: [ProfileModule],
  controllers: [PerfController],
  providers: [PerfService, PrismaService],
  exports: [PerfService],
})
export class PerfModule {}

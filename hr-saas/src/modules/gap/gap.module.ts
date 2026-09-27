import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { GapController } from './gap.controller';
import { GapService } from './gap.service';

@Module({
  controllers: [GapController],
  providers: [GapService, PrismaService],
  exports: [GapService],
})
export class GapModule {}

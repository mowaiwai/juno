import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';

@Module({
  controllers: [OrgController],
  providers: [OrgService, PrismaService],
  exports: [OrgService],
})
export class OrgModule {}

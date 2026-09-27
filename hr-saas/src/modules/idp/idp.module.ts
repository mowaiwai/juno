import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { IdpController } from './idp.controller';
import { IdpService } from './idp.service';

@Module({
  controllers: [IdpController],
  providers: [IdpService, PrismaService],
  exports: [IdpService],
})
export class IdpModule {}

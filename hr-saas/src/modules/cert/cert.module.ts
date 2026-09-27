import { Module } from '@nestjs/common';
import { ConfigService } from '../../common/config.service';
import { PrismaService } from '../../common/prisma.service';
import { ProfileModule } from '../profile/profile.module';
import { CertController } from './cert.controller';
import { CertService } from './cert.service';

@Module({
  imports: [ProfileModule],
  controllers: [CertController],
  providers: [CertService, PrismaService, ConfigService],
  exports: [CertService],
})
export class CertModule {}

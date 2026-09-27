import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ChannelController } from './channel.controller';

@Module({
  controllers: [ChannelController],
  providers: [PrismaService],
})
export class ChannelModule {}

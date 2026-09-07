import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AcquisitionFunnelController } from './acquisition-funnel.controller';
import { AcquisitionFunnelService } from './acquisition-funnel.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AcquisitionFunnelController],
  providers: [AcquisitionFunnelService],
  exports: [AcquisitionFunnelService],
})
export class AcquisitionFunnelModule {}

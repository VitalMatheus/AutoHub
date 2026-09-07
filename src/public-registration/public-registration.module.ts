import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PublicRegistrationController } from './public-registration.controller';
import { PublicRegistrationService } from './public-registration.service';
import { TrialModule } from '../trial/trial.module';
import { AcquisitionFunnelModule } from '../platform/acquisition-funnel/acquisition-funnel.module';

@Module({ imports: [CommonModule, TrialModule, AcquisitionFunnelModule], controllers: [PublicRegistrationController], providers: [PublicRegistrationService] })
export class PublicRegistrationModule {}

import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PublicRegistrationController } from './public-registration.controller';
import { PublicRegistrationService } from './public-registration.service';
import { TrialModule } from '../trial/trial.module';

@Module({ imports: [CommonModule, TrialModule], controllers: [PublicRegistrationController], providers: [PublicRegistrationService] })
export class PublicRegistrationModule {}

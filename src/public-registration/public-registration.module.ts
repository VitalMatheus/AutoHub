import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PublicRegistrationController } from './public-registration.controller';
import { PublicRegistrationService } from './public-registration.service';

@Module({ imports: [CommonModule], controllers: [PublicRegistrationController], providers: [PublicRegistrationService] })
export class PublicRegistrationModule {}

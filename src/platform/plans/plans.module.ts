import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({ imports: [AuthModule, AuditEventsModule], controllers: [PlansController], providers: [PlansService] })
export class PlansModule {}

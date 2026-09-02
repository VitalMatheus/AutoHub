import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({ imports: [AuthModule, AuditEventsModule], controllers: [SubscriptionsController], providers: [SubscriptionsService] })
export class SubscriptionsModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AccountCancellationController } from './account-cancellation.controller';
import { DataRetentionController } from './data-retention.controller';
import { DataRetentionService } from './data-retention.service';
import { AccountCancellationService } from './account-cancellation.service';

@Module({ imports: [AuthModule, CommonModule, AuditEventsModule], controllers: [AccountCancellationController, DataRetentionController], providers: [AccountCancellationService, DataRetentionService] })
export class AccountCancellationModule {}

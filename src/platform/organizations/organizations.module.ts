import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { AuditEventsModule } from '../audit-events/audit-events.module';

@Module({ imports: [AuthModule, AuditEventsModule], controllers: [OrganizationsController], providers: [OrganizationsService] })
export class OrganizationsModule {}

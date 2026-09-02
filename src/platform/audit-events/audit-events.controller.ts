import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AuditEventsService } from './audit-events.service';
import { ListAuditEventsDto } from './dto/list-audit-events.dto';

@Controller('platform/audit-events')
@ApiTags('Platform Audit Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AuditEventsController {
  constructor(private readonly auditEvents: AuditEventsService) {}

  @Get()
  list(@Query() dto: ListAuditEventsDto) { return this.auditEvents.list(dto); }
}

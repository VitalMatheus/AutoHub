import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { DataRetentionService } from './data-retention.service';

@Controller('platform/data-retention')
@ApiTags('Platform Data Retention')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class DataRetentionController {
  constructor(private readonly retention: DataRetentionService) {}

  @Post('finalize-due')
  @ApiOperation({ summary: 'Finalize Organizations whose approved retention period has ended.' })
  @ApiResponse({ status: 201, description: 'Due Organizations finalized idempotently.' })
  finalizeDue() { return this.retention.finalizeDue(); }
}

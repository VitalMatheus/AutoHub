import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AcquisitionFunnelQueryDto } from './dto/acquisition-funnel-query.dto';
import { AcquisitionFunnelResponseDto } from './dto/acquisition-funnel-response.dto';
import { AcquisitionFunnelService } from './acquisition-funnel.service';

@Controller('platform/acquisition/funnel')
@ApiTags('Platform Acquisition')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AcquisitionFunnelController {
  constructor(private readonly funnel: AcquisitionFunnelService) {}

  @Get()
  @ApiOperation({ summary: 'Measure the pseudonymous acquisition funnel.' })
  @ApiOkResponse({ type: AcquisitionFunnelResponseDto, description: 'Commercial acquisition stages only; no operational or personal payloads.' })
  @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  metrics(@Query() dto: AcquisitionFunnelQueryDto) { return this.funnel.metrics(dto); }
}

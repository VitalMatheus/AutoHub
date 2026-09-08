import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { DashboardService } from './dashboard.service';
import { WorkshopDashboardResponseDto } from './dto/workshop-dashboard-response.dto';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };
@Controller('dashboard') @ApiTags('Platform Dashboard') @ApiBearerAuth() @UseGuards(JwtAuthGuard, SuperAdminGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get() @ApiOperation({ summary: 'Return the current commercial dashboard snapshot' }) @ApiOkResponse({ type: DashboardResponseDto }) @ApiUnauthorizedResponse({ description: 'Authentication required.' }) @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  summary(@Req() request: AuthenticatedRequest, @Query() query: DashboardQueryDto) { return this.dashboard.summary(request.user!, query); }
}

@Controller('account/dashboard') @ApiTags('Account Dashboard') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
export class AccountDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get() @ApiOperation({ summary: 'Return the authenticated Organization dashboard metrics and recent activities.' }) @ApiOkResponse({ type: WorkshopDashboardResponseDto }) @ApiUnauthorizedResponse({ description: 'Authentication required.' }) @ApiForbiddenResponse({ description: 'Organization Admin access required.' })
  summary(@Req() request: AuthenticatedRequest) { return this.dashboard.workshopSummary(request.user!); }
}

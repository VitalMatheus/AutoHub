import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import type { Request } from 'express';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import { RegularizeSubscriptionDto } from './dto/regularize-subscription.dto';
import { SchedulePlanChangeDto } from './dto/schedule-plan-change.dto';
import { ScheduleRecurringAdjustmentDto } from './dto/schedule-recurring-adjustment.dto';
import { SubscriptionsService } from './subscriptions.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('platform/subscriptions') @ApiTags('Platform Subscriptions') @ApiBearerAuth() @UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}
  @Get() @ApiOperation({ summary: 'List contracted Subscriptions' }) @ApiOkResponse({ description: 'Paginated Subscriptions with immutable contract snapshots and derived conditions.' }) @ApiUnauthorizedResponse({ description: 'Authentication required.' }) @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  list(@Query() dto: ListSubscriptionsDto) { return this.subscriptions.list(dto); }
  @Get(':id') @ApiOperation({ summary: 'Inspect a Subscription and derived conditions' }) @ApiOkResponse({ description: 'Subscription contract and derived conditions.' }) @ApiUnauthorizedResponse({ description: 'Authentication required.' }) @ApiForbiddenResponse({ description: 'Super Admin access required.' }) @ApiNotFoundResponse({ description: 'Subscription not found.' })
  detail(@Param('id') id: string) { return this.subscriptions.detail(id); }
  @Post() @ApiOperation({ summary: 'Create a Subscription from a published Plan Version' }) @ApiResponse({ status: 201, description: 'Subscription created with a contract snapshot.' }) @ApiUnauthorizedResponse({ description: 'Authentication required.' }) @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSubscriptionDto) { return this.subscriptions.create(req.user!, dto); }
  @Post(':id/regularize') @ApiOperation({ summary: 'Explicitly regularize a migrated Subscription' }) @ApiResponse({ status: 201, description: 'Migrated Subscription regularized with an audit event.' }) @ApiUnauthorizedResponse({ description: 'Authentication required.' }) @ApiForbiddenResponse({ description: 'Super Admin access required.' }) @ApiNotFoundResponse({ description: 'Subscription not found.' })
  regularize(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: RegularizeSubscriptionDto) { return this.subscriptions.regularize(req.user!, id, dto); }
  @Post(':id/plan-change') @ApiOperation({ summary: 'Schedule a future Plan Version change' }) @ApiResponse({ status: 201, description: 'Plan change scheduled and audited.' }) @ApiNotFoundResponse() @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  schedulePlanChange(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SchedulePlanChangeDto) { return this.subscriptions.schedulePlanChange(req.user!, id, dto); }
  @Post(':id/recurring-price-adjustment') @ApiOperation({ summary: 'Schedule a future recurring price adjustment' }) @ApiResponse({ status: 201, description: 'Recurring price adjustment scheduled and audited.' }) @ApiNotFoundResponse() @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  scheduleRecurringAdjustment(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ScheduleRecurringAdjustmentDto) { return this.subscriptions.scheduleRecurringAdjustment(req.user!, id, dto); }
}

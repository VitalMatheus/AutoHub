import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; import { SuperAdminGuard } from '../../common/guards/super-admin.guard'; import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal'; import type { Request } from 'express';
import { SubscriptionChargesService } from './subscription-charges.service'; import { CreateChargeDto } from './dto/create-charge.dto'; import { UpdateChargeDto } from './dto/update-charge.dto'; import { ListChargesDto } from './dto/list-charges.dto'; import { CreateSettlementDto, ReverseSettlementDto } from './dto/settlement.dto'; import { BillingReconciliationCommand } from '../billing/billing-reconciliation.command';
import { ReconcileResponseDto } from './dto/reconcile-response.dto';
import { AccountSubscriptionChargeResponseDto } from './dto/account-charge-response.dto';
import { AdministrativeSettlementDto } from './dto/administrative-settlement.dto';
type R = Request & {user?:AuthenticatedPrincipal};
@Controller('platform/subscription-charges') @ApiTags('Platform Subscription Charges') @ApiBearerAuth() @UseGuards(JwtAuthGuard,SuperAdminGuard)
export class SubscriptionChargesController { constructor(private readonly service:SubscriptionChargesService){} @Post('reconcile-first-payments') reconcile(){return this.service.reconcileFirstPayments()} @Get() list(@Query() dto:ListChargesDto){return this.service.list(dto)} @Get(':id') detail(@Param('id')id:string){return this.service.detail(id)} @Post() create(@Req()r:R,@Body()dto:CreateChargeDto){return this.service.create(r.user!,dto)} @Patch(':id') update(@Req()r:R,@Param('id')id:string,@Body()dto:UpdateChargeDto){return this.service.update(r.user!,id,dto)} @Post(':id/cancel') cancel(@Req()r:R,@Param('id')id:string){return this.service.cancel(r.user!,id)} @Post(':id/settlements') settle(@Req()r:R,@Param('id')id:string,@Body()dto:CreateSettlementDto){return this.service.settle(r.user!,id,dto)} @Post(':id/administrative-settlement') @ApiResponse({ status: 201, description: 'Administrative settlement registered.' }) @ApiConflictResponse({ description: 'The charge cannot be partially, excessively, repeatedly or otherwise administratively settled.' }) administrativeSettle(@Req()r:R,@Param('id')id:string,@Body()dto:AdministrativeSettlementDto){return this.service.administrativelySettle(r.user!,id,dto)} @Post(':id/settlements/:settlementId/reverse') reverse(@Req()r:R,@Param('id')id:string,@Param('settlementId')settlementId:string,@Body()dto:ReverseSettlementDto){return this.service.reverse(r.user!,id,settlementId,dto)} }

@Controller('account') @ApiTags('Account') @UseGuards(JwtAuthGuard)
export class AccountSubscriptionChargesController {
  constructor(private readonly service: SubscriptionChargesService) {}

  @Get('subscription-charge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the open monthly charge for the authenticated Organization.' })
  @ApiResponse({ status: 200, type: AccountSubscriptionChargeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'Organization Admin access required.' })
  @ApiNotFoundResponse({ description: 'No open Subscription Charge found.' })
  charge(@Req() request: R) { return this.service.accountCharge(request.user!); }
}

@Controller('platform/billing') @ApiTags('Platform Billing') @ApiBearerAuth() @UseGuards(JwtAuthGuard,SuperAdminGuard)
export class BillingController {
  constructor(private readonly command: BillingReconciliationCommand) {}

  @Post('reconcile') @ApiOperation({ summary: 'Reconcile missing first-payment and renewal Charges.' }) @ApiResponse({ status: 201, type: ReconcileResponseDto }) @ApiResponse({ status: 403, description: 'Super Admin authorization required.' })
  reconcile() { return this.command.execute(); }
}

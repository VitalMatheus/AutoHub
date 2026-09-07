import { Body, Controller, Get, Headers, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { AsaasWebhookDto } from '../../payments/dto/asaas-webhook.dto';
import { ConfirmPixCheckoutDto, PixCheckoutResponseDto } from '../../payments/dto/pix-checkout.dto';
import { CardCheckoutResponseDto, ConfirmCardCheckoutDto } from '../../payments/dto/card-checkout.dto';
import { CardCheckoutService } from './card-checkout.service';
import { PixCheckoutService } from './pix-checkout.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('account/checkout')
@ApiTags('Account Checkout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PixCheckoutController {
  constructor(private readonly checkoutService: PixCheckoutService, private readonly cardService: CardCheckoutService) {}

  @Get()
  @ApiOperation({ summary: 'Display the snapshotted Basic Plan conditions before contracting.' })
  @ApiResponse({ status: 200, description: 'Basic Plan checkout conditions.' })
  @ApiForbiddenResponse({ description: 'Organization Admin access required.' })
  checkout(@Req() request: AuthenticatedRequest) { return this.checkoutService.checkout(request.user!); }

  @Post('pix')
  @ApiOperation({ summary: 'Explicitly contract the Basic Plan and create or retry its PIX payment.' })
  @ApiResponse({ status: 201, type: PixCheckoutResponseDto })
  createPix(@Req() request: AuthenticatedRequest, @Body() dto: ConfirmPixCheckoutDto) { return this.checkoutService.createPix(request.user!, dto); }

  @Post('card')
  @ApiOperation({ summary: 'Create or retry a hosted Asaas card checkout.' })
  @ApiResponse({ status: 201, type: CardCheckoutResponseDto })
  createCard(@Req() request: AuthenticatedRequest, @Body() dto: ConfirmCardCheckoutDto) { return this.cardService.createHostedCheckout(request.user!, dto); }

  @Post('card/renewal')
  @ApiOperation({ summary: 'Create one authorized card renewal for the open Subscription Charge.' })
  @ApiResponse({ status: 201, type: CardCheckoutResponseDto })
  renewCard(@Req() request: AuthenticatedRequest) { return this.cardService.renew(request.user!); }

  @Patch('card/renewal-authorization')
  @ApiOperation({ summary: 'Revoke future automatic card renewal authorization.' })
  @ApiResponse({ status: 200, description: 'Future renewals disabled; open charges remain payable.' })
  revokeRenewal(@Req() request: AuthenticatedRequest) { return this.cardService.revokeRenewal(request.user!); }
}

@Controller('webhooks/asaas')
@ApiTags('Asaas Webhooks')
export class AsaasWebhookController {
  constructor(private readonly checkoutService: PixCheckoutService, private readonly cardService: CardCheckoutService) {}

  @Post()
  @ApiOperation({ summary: 'Process an authenticated and verified Asaas payment event.' })
  @ApiResponse({ status: 200, description: 'Webhook accepted idempotently.' })
  @ApiUnauthorizedResponse({ description: 'Invalid webhook signature or provider verification.' })
  async webhook(@Headers('x-asaas-signature') signature: string | undefined, @Body() dto: AsaasWebhookDto) {
    const cardResult = await this.cardService.webhook(signature, dto);
    return cardResult ?? this.checkoutService.webhook(signature, dto);
  }
}

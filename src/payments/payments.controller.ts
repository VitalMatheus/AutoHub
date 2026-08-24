import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('work-orders/:workOrderId/payments') @ApiTags('Payments') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post() @ApiOperation({ summary: 'Record a confirmed Payment' }) @ApiConflictResponse({ description: 'Payment exceeds balance or Work Order is cancelled.' }) @ApiNotFoundResponse()
  create(@Req() r: AuthenticatedRequest, @Param('workOrderId') workOrderId: string, @Body() dto: CreatePaymentDto) { return this.payments.create(r.user!, workOrderId, dto); }

  @Get() @ApiOperation({ summary: 'List Payments and derived financial state' }) @ApiNotFoundResponse()
  list(@Req() r: AuthenticatedRequest, @Param('workOrderId') workOrderId: string) { return this.payments.list(r.user!, workOrderId); }

  @Post(':paymentId/cancel') @ApiOperation({ summary: 'Cancel a Payment without deleting its record' }) @ApiConflictResponse({ description: 'Payment is already cancelled.' }) @ApiNotFoundResponse()
  cancel(@Req() r: AuthenticatedRequest, @Param('workOrderId') workOrderId: string, @Param('paymentId') paymentId: string) { return this.payments.cancel(r.user!, workOrderId, paymentId); }
}

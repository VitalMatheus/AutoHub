import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccountCancellationService } from './account-cancellation.service';
import { CancellationConfirmationDto, CancellationRequestDto } from './dto/cancellation-request.dto';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('account/cancellation')
@ApiTags('Account Cancellation')
export class AccountCancellationController {
  constructor(private readonly cancellation: AccountCancellationService) {}

  @Post('request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a primary-admin cancellation confirmation e-mail.' })
  @ApiResponse({ status: 201, description: 'Confirmation e-mail requested.' })
  request(@Req() request: AuthenticatedRequest, @Body() dto: CancellationRequestDto) { return this.cancellation.request(request.user!, dto.password); }

  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a cancellation using the single-use e-mail token.' })
  @ApiResponse({ status: 200, description: 'Cancellation scheduled through the paid-through date.' })
  confirm(@Body() dto: CancellationConfirmationDto) { return this.cancellation.confirm(dto.token); }
}

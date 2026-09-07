import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PublicRegistrationService } from './public-registration.service';
import { CreateRegistrationDto, RegistrationAcceptedResponseDto } from './dto/create-registration.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';

@ApiTags('Public registration')
@Controller('public/registrations')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class PublicRegistrationController {
  constructor(private readonly registrations: PublicRegistrationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Submit a neutral, pending Self-Service Registration.' })
  @ApiResponse({ status: 202, type: RegistrationAcceptedResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid public registration data.' })
  @ApiResponse({ status: 429, description: 'Too many or suspicious requests.' })
  submit(@Body() dto: CreateRegistrationDto, @Ip() ip: string) { return this.registrations.submit(dto, ip); }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'token', required: true, minLength: 32, writeOnly: true })
  @ApiOperation({ summary: 'Confirm a pending Self-Service Registration and start its Trial Period.' })
  @ApiResponse({ status: 200, description: 'Registration confirmed with precise Trial Period instants.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired confirmation token.' })
  confirm(@Query('token') token?: string) { return this.registrations.confirm(token ?? ''); }

  @Post('confirmation/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a neutral confirmation message for a pending registration.' })
  @ApiResponse({ status: 202, type: RegistrationAcceptedResponseDto })
  resend(@Body() dto: ResendConfirmationDto, @Ip() ip: string) { return this.registrations.resendConfirmation(dto.email, ip, dto.turnstileToken); }
}

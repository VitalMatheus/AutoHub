import { Body, Controller, HttpCode, HttpStatus, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PublicRegistrationService } from './public-registration.service';
import { CreateRegistrationDto, RegistrationAcceptedResponseDto } from './dto/create-registration.dto';

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
}

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ActivateDto } from './dto/activate.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedPrincipal } from './authenticated-principal';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal; sessionId?: string };

@Controller('auth')
@ApiTags('Authentication')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }

  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  @Post('activate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  activate(@Body() dto: ActivateDto) { return this.auth.activate(dto.token, dto.password); }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  async logout(@Req() request: AuthenticatedRequest) {
    await this.auth.logout(request.sessionId!);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  me(@Req() request: AuthenticatedRequest) { return request.user; }
}

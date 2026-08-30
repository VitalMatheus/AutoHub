import { Body, Controller, ForbiddenException, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { CookieOptions } from 'express';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActivateDto } from './dto/activate.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedPrincipal } from './authenticated-principal';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { REFRESH_COOKIE_NAME } from './refresh-cookie';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal; sessionId?: string };

@Controller('auth')
@ApiTags('Authentication')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...tokens } = await this.auth.login(dto.email, dto.password);
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, this.cookieOptions());
    return tokens;
  }

  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth('refreshCookie')
  async refresh(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    this.assertAllowedCookieOrigin(request);
    const refreshToken = this.readRefreshCookie(request);
    const { refreshToken: nextRefreshToken, ...tokens } = await this.auth.refresh(refreshToken);
    response.cookie(REFRESH_COOKIE_NAME, nextRefreshToken, this.cookieOptions());
    return tokens;
  }

  @Post('activate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  activate(@Body() dto: ActivateDto) { return this.auth.activate(dto.token, dto.password); }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    if (this.hasRefreshCookie(request)) this.assertAllowedCookieOrigin(request);
    await this.auth.logout(request.sessionId!);
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  me(@Req() request: AuthenticatedRequest) { return request.user; }

  private cookieOptions(): CookieOptions {
    const prefix = this.config.getOrThrow<string>('API_PREFIX');
    const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS') ?? 30;
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.getOrThrow<string>('NODE_ENV') === 'production',
      path: `/${prefix}/auth`,
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    };
  }

  private readRefreshCookie(request: Request): string {
    const value = this.rawRefreshCookie(request);
    if (!value) throw new UnauthorizedException('Authentication required');
    try {
      return decodeURIComponent(value);
    } catch {
      throw new UnauthorizedException('Authentication required');
    }
  }

  private hasRefreshCookie(request: Request): boolean {
    return Boolean(this.rawRefreshCookie(request));
  }

  private rawRefreshCookie(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie;
    const prefix = `${REFRESH_COOKIE_NAME}=`;
    return cookieHeader?.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix))?.slice(prefix.length);
  }

  private assertAllowedCookieOrigin(request: Request): void {
    const origin = request.headers.origin;
    const allowedOrigins = this.config.getOrThrow<string>('CORS_ORIGINS').split(',').map((value) => value.trim());
    if (!origin || !allowedOrigins.includes(origin)) throw new ForbiddenException('Invalid request origin');
  }
}

import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { CookieOptions } from 'express';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActivateDto } from './dto/activate.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedPrincipal } from './authenticated-principal';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { REFRESH_COOKIE_NAME } from './refresh-cookie';
import { AuthenticatedPrincipalResponseDto, AuthTokensResponseDto, SuccessResponseDto } from './dto/auth-response.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-recovery.dto';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal; sessionId?: string };

class AccountAccessStatusDto {
  @ApiProperty({ enum: ['ACCESS_ALLOWED', 'PAYMENT_GRACE_PERIOD', 'PAYMENT_BLOCKED', 'DATA_RETENTION_EXPIRED'] }) commercialAccess!: string;
  @ApiPropertyOptional({ nullable: true }) nextDueDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) blockDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) remainingDays!: number | null;
  @ApiProperty() instruction!: string;
  @ApiPropertyOptional({ nullable: true }) cancellation!: { effectiveAt: string; retentionEndsAt: string | null; finalizedAt: string | null } | null;
}

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
  @ApiOperation({ summary: 'Authenticate and establish a refresh session cookie.' })
  @ApiResponse({ status: 201, type: AuthTokensResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  @ApiResponse({ status: 401, description: 'Invalid credentials.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  @ApiResponse({ status: 429, description: 'Too many requests.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...tokens } = await this.auth.login(dto.email, dto.password);
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, this.cookieOptions());
    return tokens;
  }

  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth('refreshCookie')
  @ApiOperation({ summary: 'Rotate the HttpOnly refresh session cookie.' })
  @ApiResponse({ status: 201, type: AuthTokensResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  @ApiResponse({ status: 401, description: 'Authentication required.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  @ApiResponse({ status: 403, description: 'Invalid request origin.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  @ApiResponse({ status: 429, description: 'Too many requests.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  async refresh(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    this.assertAllowedCookieOrigin(request);
    const refreshToken = this.readRefreshCookie(request);
    const { refreshToken: nextRefreshToken, ...tokens } = await this.auth.refresh(refreshToken);
    response.cookie(REFRESH_COOKIE_NAME, nextRefreshToken, this.cookieOptions());
    return tokens;
  }

  @Post('activate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Activate an invited account.' })
  @ApiResponse({ status: 201, type: SuccessResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  @ApiResponse({ status: 401, description: 'Invalid or expired activation token.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  @ApiResponse({ status: 429, description: 'Too many requests.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  activate(@Body() dto: ActivateDto) { return this.auth.activate(dto.token, dto.password); }

  @Post('password-reset/request')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a neutral password recovery message.' })
  @ApiResponse({ status: 202, description: 'The same response is returned whether or not the e-mail exists.' })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) { return this.auth.requestPasswordReset(dto.email); }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Consume a single-use password recovery token.' })
  @ApiResponse({ status: 201, type: SuccessResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired password recovery token.' })
  resetPassword(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto.token, dto.password); }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current session and clear its refresh cookie.' })
  @ApiResponse({ status: 201, type: SuccessResponseDto })
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    if (this.hasRefreshCookie(request)) this.assertAllowedCookieOrigin(request);
    await this.auth.logout(request.sessionId!);
    response.clearCookie(REFRESH_COOKIE_NAME, this.clearCookieOptions());
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated principal.' })
  @ApiResponse({ status: 200, type: AuthenticatedPrincipalResponseDto })
  me(@Req() request: AuthenticatedRequest) { return request.user; }

  private cookieOptions(): CookieOptions {
    const prefix = this.config.getOrThrow<string>('API_PREFIX');
    const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS') ?? 30;
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.getOrThrow<string>('NODE_ENV') === 'production',
      path: `/${prefix}/auth`,
      ...(this.config.get<string>('REFRESH_COOKIE_DOMAIN') ? { domain: this.config.get<string>('REFRESH_COOKIE_DOMAIN') } : {}),
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    };
  }

  private clearCookieOptions(): CookieOptions {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    return options;
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

@Controller('account')
@ApiTags('Account')
export class AccountController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('access-status')
  @ApiOperation({ summary: 'Return the safe commercial access status for the current Organization.' })
  @ApiResponse({ status: 200, type: AccountAccessStatusDto })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'The Organization is not operationally active.', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } })
  accessStatus(@Req() request: AuthenticatedRequest) {
    if (!request.user?.organizationId) return { commercialAccess: 'ACCESS_ALLOWED', nextDueDate: null, blockDate: null, remainingDays: null, instruction: 'Your account is available.' };
    return this.auth.accessStatus(request.user.organizationId);
  }
}

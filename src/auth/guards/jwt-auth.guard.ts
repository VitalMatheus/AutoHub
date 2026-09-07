import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { AccessTokenPayload, AuthenticatedPrincipal } from '../authenticated-principal';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal; sessionId?: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request);
    if (!token) throw new UnauthorizedException('Authentication required');

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (!payload.sub || !payload.sid) throw new UnauthorizedException('Authentication required');
      const principal = await this.auth.resolvePrincipal(payload.sub, payload.sid, true);
      if (principal.role === 'ADMIN' && principal.organizationId && await this.auth.isDataRetentionExpired(principal.organizationId)) {
        throw new ForbiddenException({ code: 'DATA_RETENTION_EXPIRED', detail: 'The retained-data period has ended.' });
      }
      // Commercial restriction is a read-only boundary. Every authenticated
      // read remains available, while only security, support, and payment
      // flows may mutate state during the restriction.
      const operationalAccessExempt = new Set(['/api/v1/auth/logout', '/api/v1/account/access-status']);
      if (principal.role === 'ADMIN' && principal.organizationId && !operationalAccessExempt.has(request.path)) {
        await this.auth.assertOperationalAccess(principal.organizationId);
      }
      if (principal.role === 'ADMIN' && principal.organizationId && !this.isCommerciallyAllowed(request)) {
        const trialExpired = this.auth.isTrialExpired
          ? await this.auth.isTrialExpired(principal.organizationId)
          : false;
        if (trialExpired && this.isCommerciallyAllowed(request)) {
          request.user = principal;
          request.sessionId = payload.sid;
          return true;
        }
        if (trialExpired) throw new ForbiddenException({ code: 'TRIAL_EXPIRED', detail: 'Trial access has expired; operational changes are unavailable until a Plan is contracted.' });
        const accessAllowed = await this.auth.hasCommercialAccess(principal.organizationId);
        if (!accessAllowed) throw new ForbiddenException({ code: 'COMMERCIAL_ACCESS_BLOCKED', detail: 'Commercial access is blocked until the first Subscription Charge is settled.' });
      }
      request.user = principal;
      request.sessionId = payload.sid;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) throw error;
      throw new UnauthorizedException('Authentication required');
    }
  }

  private isCommerciallyAllowed(request: Request): boolean {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;

    const path = request.path.replace(/\/$/, '');
    return new Set([
      '/api/v1/auth/me',
      '/api/v1/auth/logout',
      '/api/v1/account/access-status',
      '/api/v1/account/subscription-charge',
    ]).has(path)
      || path === '/api/v1/account/checkout'
      || path.startsWith('/api/v1/account/checkout/')
      || path.startsWith('/api/v1/account/cancellation/')
      || path.startsWith('/api/v1/support/');
  }

  private bearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return undefined;
    const token = authorization.slice('Bearer '.length).trim();
    return token || undefined;
  }
}

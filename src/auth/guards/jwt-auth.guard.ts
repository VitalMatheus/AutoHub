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
      // Keep this allowlist explicit and endpoint-specific. Commercial access
      // must not be bypassed by a broad path prefix, while status and session
      // management remain available so a blocked workshop can recover.
      const commercialAccessExempt = new Set(['/api/v1/auth/me', '/api/v1/auth/logout', '/api/v1/account/access-status', '/api/v1/account/subscription-charge', '/api/v1/account/dashboard']);
      const operationalAccessExempt = new Set(['/api/v1/auth/logout', '/api/v1/account/access-status']);
      if (principal.role === 'ADMIN' && principal.organizationId && !operationalAccessExempt.has(request.path)) {
        await this.auth.assertOperationalAccess(principal.organizationId);
      }
      if (principal.role === 'ADMIN' && principal.organizationId && !commercialAccessExempt.has(request.path)) {
        const trialExpired = this.auth.isTrialExpired
          ? await this.auth.isTrialExpired(principal.organizationId)
          : false;
        if (trialExpired && ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
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

  private bearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return undefined;
    const token = authorization.slice('Bearer '.length).trim();
    return token || undefined;
  }
}

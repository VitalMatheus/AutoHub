import {
  CanActivate,
  ExecutionContext,
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
      const principal = await this.auth.resolvePrincipal(payload.sub, payload.sid);
      request.user = principal;
      request.sessionId = payload.sid;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
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

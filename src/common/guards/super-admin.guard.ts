import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedPrincipal }>();
    if (request.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Platform access requires Super Admin');
    return true;
  }
}

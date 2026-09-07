import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

function contextWithRole(role: 'ADMIN' | 'SUPER_ADMIN'): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) } as unknown as ExecutionContext;
}

describe('SuperAdminGuard', () => {
  it('rejects Organization Admin access to platform endpoints', () => {
    expect(() => new SuperAdminGuard().canActivate(contextWithRole('ADMIN'))).toThrow(ForbiddenException);
  });

  it('allows only Super Admin access', () => {
    expect(new SuperAdminGuard().canActivate(contextWithRole('SUPER_ADMIN'))).toBe(true);
  });
});

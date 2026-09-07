import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function context(path: string) {
  const request: any = { path, headers: { authorization: 'Bearer token' } };
  return { request, execution: { switchToHttp: () => ({ getRequest: () => request }) } as any };
}

function methodContext(path: string, method: string) {
  const value = context(path);
  value.request.method = method;
  return value;
}

describe('JwtAuthGuard commercial access', () => {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sid: 'session-1' }) } as any;

  it.each(['/api/v1/auth/me', '/api/v1/auth/logout', '/api/v1/account/access-status', '/api/v1/account/subscription-charge'])
    ('allows blocked admins to use the recovery route %s', async (path) => {
      const auth = {
        resolvePrincipal: jest.fn().mockResolvedValue({ id: 'user-1', role: 'ADMIN', organizationId: 'org-1' }),
        assertOperationalAccess: jest.fn().mockResolvedValue(undefined),
        hasCommercialAccess: jest.fn().mockResolvedValue(false),
      };
      const guard = new JwtAuthGuard(jwt, auth as any);
      await expect(guard.canActivate(context(path).execution)).resolves.toBe(true);
      expect(auth.hasCommercialAccess).not.toHaveBeenCalled();
    });

  it('blocks operational routes but keeps the session valid', async () => {
    const auth = {
      resolvePrincipal: jest.fn().mockResolvedValue({ id: 'user-1', role: 'ADMIN', organizationId: 'org-1' }),
      assertOperationalAccess: jest.fn().mockResolvedValue(undefined),
      hasCommercialAccess: jest.fn().mockResolvedValue(false),
    };
    const guard = new JwtAuthGuard(jwt, auth as any);
    await expect(guard.canActivate(context('/api/v1/customers').execution)).rejects.toBeInstanceOf(ForbiddenException);
    expect(auth.hasCommercialAccess).toHaveBeenCalledWith('org-1');
    expect(auth).not.toHaveProperty('revokeAllSessions');
  });

  it('does not apply tenant commercial blocking to Super Admin', async () => {
    const auth = {
      resolvePrincipal: jest.fn().mockResolvedValue({ id: 'super-1', role: 'SUPER_ADMIN', organizationId: null }),
      assertOperationalAccess: jest.fn(), hasCommercialAccess: jest.fn(),
    };
    const guard = new JwtAuthGuard(jwt, auth as any);
    await expect(guard.canActivate(context('/api/v1/platform/organizations').execution)).resolves.toBe(true);
    expect(auth.assertOperationalAccess).not.toHaveBeenCalled();
    expect(auth.hasCommercialAccess).not.toHaveBeenCalled();
  });

  it('keeps tenant reads available at the exact Trial expiry boundary', async () => {
    const auth = {
      resolvePrincipal: jest.fn().mockResolvedValue({ id: 'user-1', role: 'ADMIN', organizationId: 'org-1' }),
      assertOperationalAccess: jest.fn().mockResolvedValue(undefined),
      isTrialExpired: jest.fn().mockResolvedValue(true),
      hasCommercialAccess: jest.fn(),
    };
    const guard = new JwtAuthGuard(jwt, auth as any);
    await expect(guard.canActivate(methodContext('/api/v1/customers', 'GET').execution)).resolves.toBe(true);
    expect(auth.hasCommercialAccess).not.toHaveBeenCalled();
  });

  it('returns a stable Trial expiry code for tenant mutations', async () => {
    const auth = {
      resolvePrincipal: jest.fn().mockResolvedValue({ id: 'user-1', role: 'ADMIN', organizationId: 'org-1' }),
      assertOperationalAccess: jest.fn().mockResolvedValue(undefined),
      isTrialExpired: jest.fn().mockResolvedValue(true),
      hasCommercialAccess: jest.fn(),
    };
    const guard = new JwtAuthGuard(jwt, auth as any);
    await expect(guard.canActivate(methodContext('/api/v1/customers', 'POST').execution)).rejects.toMatchObject({ response: { code: 'TRIAL_EXPIRED' } });
  });
});

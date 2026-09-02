import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService session rules', () => {
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') } as never;
  const config = { get: jest.fn().mockReturnValue(30) } as never;

  it('rotates a refresh hash and returns a different refresh credential', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn().mockResolvedValue({ userId: 'user-1' });
    const prisma = {
      session: { findFirst: jest.fn()
        .mockResolvedValueOnce({
          id: 'session-1', userId: 'user-1', revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        })
        .mockResolvedValueOnce({ user: {
          id: 'user-1', name: 'User', email: 'user@example.com', role: 'ADMIN',
          organizationId: 'org-1', status: 'ACTIVE', organization: { operationalStatus: 'ACTIVE' },
        } }) },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({ session: { updateMany, findUnique } })),
    } as never;
    const service = new AuthService(prisma, jwt, config);

    const result = await service.refresh('old-refresh-token');

    expect(result.refreshToken).not.toBe('old-refresh-token');
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'session-1', revokedAt: null }),
      data: { refreshTokenHash: expect.not.stringMatching(/^old-refresh-token$/) },
    }));
  });

  it('rejects an expired session before issuing a new credential', async () => {
    const prisma = { session: { findFirst: jest.fn().mockResolvedValue({
      id: 'session-1', userId: 'user-1', revokedAt: null, expiresAt: new Date(Date.now() - 1),
    }) } } as never;
    const service = new AuthService(prisma, jwt, config);

    await expect(service.refresh('expired')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes all sessions for an administrative operation', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = { session: { updateMany } } as never;
    const service = new AuthService(prisma, jwt, config);

    await service.revokeAllSessions('user-1');

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    }));
  });

  it('revokes only the requested current session on logout', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { session: { updateMany } } as never;
    const service = new AuthService(prisma, jwt, config);

    await service.logout('session-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('returns no sensitive fields and rejects a disabled user principal', async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce({ user: {
        id: 'user-1', name: 'User', email: 'user@example.com', role: 'ADMIN',
        organizationId: 'org-1', status: 'ACTIVE', passwordHash: 'secret',
        organization: { operationalStatus: 'ACTIVE' },
      } })
      .mockResolvedValueOnce({ user: {
        id: 'user-1', name: 'User', email: 'user@example.com', role: 'ADMIN',
        organizationId: 'org-1', status: 'DISABLED', organization: { operationalStatus: 'ACTIVE' },
      } });
    const prisma = { session: { findFirst } } as never;
    const service = new AuthService(prisma, jwt, config);

    await expect(service.resolvePrincipal('user-1', 'session-1')).resolves.toEqual({
      id: 'user-1', name: 'User', email: 'user@example.com', role: 'ADMIN', organizationId: 'org-1',
    });
    await expect(service.resolvePrincipal('user-1', 'session-1')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

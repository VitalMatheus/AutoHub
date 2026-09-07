import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { TransactionalEmailService } from '../common/transactional-email.service';
import { TurnstileService } from '../common/turnstile.service';
import { PublicRegistrationService, REGISTRATION_NEUTRAL_MESSAGE } from './public-registration.service';

const dto = { workshopName: ' Oficina Teste ', document: '529.982.247-25', phone: '(81) 99999-9999', responsibleName: ' Ana ', email: ' ANA@EXAMPLE.COM ', password: 'a-secure-password', termsAccepted: true, privacyAccepted: true, marketingConsent: false };

describe('PublicRegistrationService', () => {
  function setup(overrides: Record<string, unknown> = {}) {
    const tx = {
      $executeRaw: jest.fn(), user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      organization: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'org-1' }) },
      trialEligibilityRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      planVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'version-1', price: new Prisma.Decimal('79.00'), currency: 'BRL', interval: 'MONTHLY', organizationLimit: 1, userLimit: 3, workOrderLimit: null, gracePeriodDays: 5 }) },
      commercialAccount: { create: jest.fn().mockResolvedValue({ id: 'account-1' }), update: jest.fn() },
      actionToken: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, subscription: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() }, consentRecord: { createMany: jest.fn() }, auditEvent: { create: jest.fn() },
      ...overrides,
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) } as any;
    const config = new ConfigService({ JWT_ACCESS_SECRET: 'a'.repeat(32), PUBLIC_APP_URL: 'http://localhost:5173', ARGON2_MEMORY_COST: 8192, ARGON2_TIME_COST: 1, ARGON2_PARALLELISM: 1, EMAIL_DELIVERY_MODE: 'capture' });
    const email = { send: jest.fn().mockResolvedValue(undefined) } as unknown as TransactionalEmailService;
    const turnstile = { assertAllowed: jest.fn().mockResolvedValue(undefined) } as unknown as TurnstileService;
    return { service: new PublicRegistrationService(prisma, config, email, turnstile), tx, prisma, email };
  }

  it('normalizes identifiers, stores a pending account atomically, and sends no secret in the response', async () => {
    const { service, tx, email } = setup();
    await expect(service.submit(dto, '127.0.0.1')).resolves.toEqual({ message: REGISTRATION_NEUTRAL_MESSAGE });
    expect(tx.organization.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ document: '52998224725', email: 'ana@example.com' }) }));
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: 'ana@example.com', status: 'PENDING_ACTIVATION', role: 'ADMIN' }) }));
    expect(tx.actionToken.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tokenHash: expect.not.stringMatching('a-secure-password') }) }));
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@example.com' }));
  });

  it('returns the same neutral result for an existing identifier without creating or sending', async () => {
    const user = { findUnique: jest.fn().mockResolvedValue({ id: 'already-there' }) };
    const { service, tx, email } = setup({ user });
    await expect(service.submit(dto)).resolves.toEqual({ message: REGISTRATION_NEUTRAL_MESSAGE });
    expect(tx.organization.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('confirms a valid token once and starts an exact fourteen-day trial', async () => {
    const actionToken = { create: jest.fn(), findFirst: jest.fn().mockResolvedValue({ id: 'token-1', userId: 'user-1' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    const user = { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'ana@example.com', status: 'PENDING_ACTIVATION', organizationId: 'org-1', organization: { document: '52998224725', operationalStatus: 'ACTIVE', commercialAccountId: 'account-1' } }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    const subscription = { create: jest.fn(), findFirst: jest.fn().mockResolvedValue({ id: 'subscription-1', trialStartsAt: null, trialEndsAt: null }), update: jest.fn() };
    const { service, tx } = setup({ actionToken, user, subscription });

    const result = await service.confirm('a'.repeat(43));

    expect(result.success).toBe(true);
    expect(new Date(result.trialEndsAt).getTime() - new Date(result.trialStartsAt).getTime()).toBe(14 * 24 * 60 * 60 * 1000);
    expect(tx.trialEligibilityRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ trialStartedAt: expect.any(Date) }) }));
    expect(user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ACTIVE' } }));
  });

  it('rejects an already consumed or unknown confirmation token', async () => {
    const actionToken = { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() };
    const { service } = setup({ actionToken });

    await expect(service.confirm('a'.repeat(43))).rejects.toThrow('Activation token is invalid or expired');
  });
});

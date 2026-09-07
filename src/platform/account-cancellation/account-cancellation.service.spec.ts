import { Prisma } from '@prisma/client';
import { AccountCancellationService } from './account-cancellation.service';

const principal = { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'ADMIN', organizationId: 'org-1' } as const;

describe('AccountCancellationService', () => {
  it('requires the current password and sends a single-use confirmation request only to the primary admin', async () => {
    const tx = {
      commercialAccount: { findFirst: jest.fn().mockResolvedValue({ id: 'account-1', primaryContact: { email: 'ana@example.com' } }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', commercialAccountId: 'account-1', effectiveCancellationAt: null }) },
      actionToken: { updateMany: jest.fn(), create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) };
    const auth = { verifyCurrentPassword: jest.fn().mockResolvedValue(undefined) };
    const email = { send: jest.fn().mockResolvedValue(undefined) };
    const config = { getOrThrow: jest.fn().mockReturnValue('https://app.example') };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new AccountCancellationService(prisma as never, auth as never, email as never, config as never, audit as never);

    await expect(service.request(principal, 'correct horse battery staple')).resolves.toEqual({ message: expect.stringContaining('confirmação') });
    expect(auth.verifyCurrentPassword).toHaveBeenCalledWith(principal, 'correct horse battery staple');
    expect(tx.actionToken.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ purpose: 'CONFIRM_SUBSCRIPTION_CANCELLATION', targetSubscriptionId: 'sub-1' }) }));
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@example.com' }));
  });

  it('confirms cancellation through paid-through and retains export access for 90 days', async () => {
    const effective = new Date('2099-02-01T03:00:00Z');
    const retention = new Date('2099-05-02T03:00:00Z');
    const tx = {
      actionToken: {
        findFirst: jest.fn().mockResolvedValue({ id: 'token-1', userId: 'user-1', targetSubscriptionId: 'sub-1', user: { id: 'user-1', organizationId: 'org-1', role: 'ADMIN', status: 'ACTIVE', email: 'ana@example.com', organization: { id: 'org-1', commercialAccountId: 'account-1' } } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      commercialAccount: { findFirst: jest.fn().mockResolvedValue({ id: 'account-1' }) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', commercialAccountId: 'account-1', status: 'CURRENT', currentPeriodEnd: effective, trialEndsAt: null, firstPaidPeriodStartedAt: null, cancellationRequestedAt: null, effectiveCancellationAt: null }),
        update: jest.fn().mockResolvedValue({ effectiveCancellationAt: effective, dataRetentionEndsAt: retention }),
      },
      auditEvent: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new AccountCancellationService(prisma as never, {} as never, {} as never, {} as never, audit as never);

    await expect(service.confirm('confirmation-token')).resolves.toMatchObject({ success: true, effectiveCancellationAt: effective.toISOString(), dataRetentionEndsAt: retention.toISOString() });
    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ effectiveCancellationAt: effective, dataRetentionEndsAt: expect.any(Date) }) }));
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('does not allow a token from another account to cancel a Subscription', async () => {
    const tx = {
      actionToken: { findFirst: jest.fn().mockResolvedValue({ id: 'token-1', userId: 'user-1', targetSubscriptionId: 'sub-1', user: { id: 'user-1', organizationId: 'org-1', role: 'ADMIN', status: 'ACTIVE', email: 'ana@example.com', organization: { id: 'org-1', commercialAccountId: 'account-1' } } }) },
      commercialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AccountCancellationService({ $transaction: (callback: (value: unknown) => unknown) => callback(tx) } as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.confirm('token')).rejects.toThrow('invalid or expired');
  });
});

import { deriveSubscriptionConditions, SubscriptionsService } from './subscriptions.service';
import { Prisma } from '@prisma/client';

const base = {
  status: 'SCHEDULED' as const, migratedAt: null, regularizedAt: null, trialEnabled: true, trialStartsAt: null, trialEndsAt: null,
  firstPaymentReceivedAt: null, cancellationRequestedAt: null, effectiveCancellationAt: null,
};

describe('deriveSubscriptionConditions', () => {
  it('keeps a migrated account in Pending Commercial Setup without trial or payment debt', () => {
    expect(deriveSubscriptionConditions({ ...base, migratedAt: new Date('2026-01-01') })).toMatchObject({
      pendingCommercialSetup: true, trial: false, awaitingFirstPayment: false, delinquent: false,
    });
  });

  it('keeps trial through day 14 and blocks at day 15 midnight', () => {
    const subscription = { ...base, trialStartsAt: new Date('2026-01-01T00:00:00Z'), trialEndsAt: new Date('2026-01-15T00:00:00Z') };
    expect(deriveSubscriptionConditions(subscription, new Date('2026-01-14T23:59:59Z')).trial).toBe(true);
    expect(deriveSubscriptionConditions(subscription, new Date('2026-01-15T00:00:00Z')).trial).toBe(false);
  });

  it('derives Awaiting First Payment and scheduled cancellation independently', () => {
    expect(deriveSubscriptionConditions({ ...base, regularizedAt: new Date(), cancellationRequestedAt: new Date() })).toMatchObject({
      awaitingFirstPayment: true, scheduledCancellation: true, effectiveCancellation: false,
    });
  });

  it('derives renewal delinquency and grace without changing pending setup semantics', () => {
    const subscription = {
      ...base,
      firstPaymentReceivedAt: new Date('2026-08-15T03:00:00Z'),
      charges: [{ nature: 'RENEWAL', amount: new Prisma.Decimal('79.00'), dueDate: new Date('2026-09-15T00:00:00Z'), cancelledAt: null, settlements: [] }],
    };
    expect(deriveSubscriptionConditions(subscription, new Date('2026-09-20T03:00:00Z'))).toMatchObject({ delinquent: true, paymentGracePeriod: true, commercialAccess: 'PAYMENT_GRACE_PERIOD' });
    expect(deriveSubscriptionConditions(subscription, new Date('2026-09-21T03:00:00Z')).commercialAccess).toBe('PAYMENT_BLOCKED');
  });
});

describe('scheduled commercial changes', () => {
  it('rejects a recurring adjustment that would make the Contracted Price negative', async () => {
    const tx = {
      subscription: { findUnique: jest.fn().mockResolvedValue({ id: 's', status: 'CURRENT', contractedPrice: new Prisma.Decimal('5.00') }) },
    };
    const service = new SubscriptionsService({ $transaction: (cb: (arg: unknown) => unknown) => cb(tx) } as never, { record: jest.fn() } as never);
    await expect(service.scheduleRecurringAdjustment({} as never, 's', { amount: '-5.01', effectiveAt: '2099-01-01T00:00:00Z', reason: 'correction' })).rejects.toThrow('negative');
  });

  it('requires scheduled changes to have a future effective date', async () => {
    const service = new SubscriptionsService({} as never, {} as never);
    await expect(service.scheduleRecurringAdjustment({} as never, 's', { amount: '1.00', effectiveAt: '2020-01-01T00:00:00Z', reason: 'correction' })).rejects.toThrow('future');
  });
});

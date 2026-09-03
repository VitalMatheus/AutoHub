import { deriveSubscriptionConditions, SubscriptionsService } from './subscriptions.service';
import { Prisma } from '@prisma/client';

const base = {
  status: 'SCHEDULED' as const, migratedAt: null, regularizedAt: null, trialEnabled: true, trialStartsAt: null, trialEndsAt: null,
  firstDueDate: null, billingDay: null,
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
    expect(deriveSubscriptionConditions({ ...base, regularizedAt: new Date(), firstDueDate: new Date('2026-02-15'), billingDay: 15, cancellationRequestedAt: new Date() })).toMatchObject({
      awaitingFirstPayment: true, scheduledCancellation: true, effectiveCancellation: false,
    });
  });

  it('derives renewal delinquency and grace without changing pending setup semantics', () => {
    const subscription = {
      ...base,
      firstDueDate: new Date('2026-01-15T03:00:00Z'), billingDay: 15,
      firstPaymentReceivedAt: new Date('2026-08-15T03:00:00Z'),
      charges: [{ nature: 'RENEWAL', amount: new Prisma.Decimal('79.00'), dueDate: new Date('2026-09-15T00:00:00Z'), cancelledAt: null, settlements: [] }],
    };
    expect(deriveSubscriptionConditions(subscription, new Date('2026-09-20T03:00:00Z'))).toMatchObject({ delinquent: true, paymentGracePeriod: true, commercialAccess: 'PAYMENT_GRACE_PERIOD' });
    expect(deriveSubscriptionConditions(subscription, new Date('2026-09-21T03:00:00Z')).commercialAccess).toBe('PAYMENT_BLOCKED');
  });

  it('does not treat a future cancellation as effective before its date', () => {
    const subscription = { ...base, firstDueDate: new Date('2026-01-15'), billingDay: 15, firstPaymentReceivedAt: new Date('2026-01-01'), effectiveCancellationAt: new Date('2026-02-01T00:00:00Z') };
    expect(deriveSubscriptionConditions(subscription, new Date('2026-01-31T23:59:59Z'))).toMatchObject({ effectiveCancellation: false, commercialAccess: 'ACCESS_ALLOWED' });
    expect(deriveSubscriptionConditions(subscription, new Date('2026-02-01T00:00:00Z'))).toMatchObject({ effectiveCancellation: true, commercialAccess: 'PAYMENT_BLOCKED' });
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

describe('subscription cancellation lifecycle', () => {
  const row = (overrides = {}) => ({
    id: 's', commercialAccountId: 'account', planVersionId: 'plan', status: 'CURRENT', contractedPrice: new Prisma.Decimal('79.00'),
    contractedCurrency: 'BRL', contractedInterval: 'MONTHLY', contractedOrganizationLimit: 1, contractedUserLimit: 1, contractedWorkOrderLimit: null,
    contractedGracePeriodDays: 5, migratedAt: null, regularizedAt: null, regularizationReason: null, commercialStartAt: new Date('2026-01-01'),
    firstPaymentReceivedAt: new Date('2026-01-01'), firstPaidPeriodStartedAt: new Date('2026-01-01'), trialEnabled: false, trialStartsAt: null, trialEndsAt: null,
    currentPeriodStart: new Date('2026-01-01'), currentPeriodEnd: new Date('2099-02-01'), cancellationRequestedAt: null, effectiveCancellationAt: null,
    createdAt: new Date('2026-01-01'), scheduledPlanVersionId: null, scheduledPlanEffectiveAt: null, scheduledPlanReason: null,
    scheduledRecurringAdjustment: null, scheduledAdjustmentEffectiveAt: null, scheduledAdjustmentReason: null,
    planVersion: { id: 'plan', version: 1, plan: { id: 'p', name: 'Basic' } }, commercialAccount: { id: 'account', name: 'Account' }, charges: [], ...overrides,
  });

  it('schedules cancellation at the current period end and can undo it before that date', async () => {
    const initial = row(); const updated = row({ cancellationRequestedAt: new Date(), effectiveCancellationAt: initial.currentPeriodEnd });
    const tx = { subscription: { findUnique: jest.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(updated).mockResolvedValueOnce(updated), update: jest.fn().mockResolvedValueOnce(updated).mockResolvedValueOnce(initial) } };
    const audit = { record: jest.fn() };
    const service = new SubscriptionsService({ $transaction: (cb: (arg: unknown) => unknown) => cb(tx) } as never, audit as never);
    const scheduled = await service.requestCancellation({} as never, 's', 'customer request');
    expect(scheduled.conditions.scheduledCancellation).toBe(true);
    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ effectiveCancellationAt: initial.currentPeriodEnd }) }));
    await service.undoCancellation({} as never, 's', 'retained account');
    expect(tx.subscription.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { cancellationRequestedAt: null, effectiveCancellationAt: null } }));
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('derives the next monthly period for a paid migrated Subscription without an end date', async () => {
    const initial = row({ currentPeriodEnd: null, trialEndsAt: null, firstPaidPeriodStartedAt: new Date('2099-01-31T03:00:00Z') });
    const updated = row({ ...initial, cancellationRequestedAt: new Date(), effectiveCancellationAt: new Date('2099-02-28T03:00:00Z') });
    const tx = { subscription: { findUnique: jest.fn().mockResolvedValue(initial), update: jest.fn().mockResolvedValue(updated) } };
    const service = new SubscriptionsService({ $transaction: (cb: (arg: unknown) => unknown) => cb(tx) } as never, { record: jest.fn() } as never);

    await expect(service.requestCancellation({} as never, 's', 'migrated account')).resolves.toBeDefined();
    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ effectiveCancellationAt: new Date('2099-02-28T03:00:00Z') }) }));
  });

  it('rejects undo after the effective date', async () => {
    const ended = row({ cancellationRequestedAt: new Date('2026-01-01'), effectiveCancellationAt: new Date('2026-01-02') });
    const tx = { subscription: { findUnique: jest.fn().mockResolvedValue(ended) } };
    const service = new SubscriptionsService({ $transaction: (cb: (arg: unknown) => unknown) => cb(tx) } as never, { record: jest.fn() } as never);
    await expect(service.undoCancellation({} as never, 's', 'too late')).rejects.toThrow('cannot be undone');
  });
});

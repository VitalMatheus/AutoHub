import { deriveSubscriptionConditions } from './subscriptions.service';

const base = {
  status: 'SCHEDULED' as const, migratedAt: null, regularizedAt: null, trialStartsAt: null, trialEndsAt: null,
  firstPaymentReceivedAt: null, cancellationRequestedAt: null, effectiveCancellationAt: null,
};

describe('deriveSubscriptionConditions', () => {
  it('keeps a migrated account in Pending Commercial Setup without trial or payment debt', () => {
    expect(deriveSubscriptionConditions({ ...base, migratedAt: new Date('2026-01-01') })).toMatchObject({
      pendingCommercialSetup: true, trial: false, awaitingFirstPayment: false, delinquent: false,
    });
  });

  it('includes both endpoints of the fourteen-day trial', () => {
    const subscription = { ...base, trialStartsAt: new Date('2026-01-01T00:00:00Z'), trialEndsAt: new Date('2026-01-15T00:00:00Z') };
    expect(deriveSubscriptionConditions(subscription, new Date('2026-01-15T00:00:00Z')).trial).toBe(true);
    expect(deriveSubscriptionConditions(subscription, new Date('2026-01-15T00:00:01Z')).trial).toBe(false);
  });

  it('derives Awaiting First Payment and scheduled cancellation independently', () => {
    expect(deriveSubscriptionConditions({ ...base, regularizedAt: new Date(), cancellationRequestedAt: new Date() })).toMatchObject({
      awaitingFirstPayment: true, scheduledCancellation: true, effectiveCancellation: false,
    });
  });
});

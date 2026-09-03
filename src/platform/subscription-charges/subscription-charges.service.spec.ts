import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { deriveChargeCondition, SubscriptionChargesService } from './subscription-charges.service';
import { addAnchoredCivilMonths, addCivilDays, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';
import { deriveCommercialAccess } from '../billing/commercial-access';

describe('deriveChargeCondition', () => {
  const charge = { amount: new Prisma.Decimal('100.00'), dueDate: new Date('2026-09-02T00:00:00Z'), cancelledAt: null, settlements: [] };
  it('keeps a charge pending through its civil due date and overdue on the following day', () => {
    expect(deriveChargeCondition(charge, new Date('2026-09-02T23:59:59Z'))).toMatchObject({ condition: 'PENDING', paidAmount: '0.00', outstandingAmount: '100.00' });
    expect(deriveChargeCondition(charge, new Date('2026-09-03T00:00:00Z')).condition).toBe('OVERDUE');
  });
  it('derives partial and paid using decimal-safe arithmetic', () => {
    const asOf = new Date('2026-09-02T23:59:59Z');
    expect(deriveChargeCondition({ ...charge, settlements: [{ amount: new Prisma.Decimal('33.33') }] }, asOf)).toMatchObject({ condition: 'PARTIALLY_PAID', paidAmount: '33.33', outstandingAmount: '66.67' });
    expect(deriveChargeCondition({ ...charge, settlements: [{ amount: new Prisma.Decimal('33.33') }, { amount: new Prisma.Decimal('66.67') }] }, asOf).condition).toBe('PAID');
  });
  it('derives cancelled independently of settlements', () => {
    expect(deriveChargeCondition({ ...charge, cancelledAt: new Date(), settlements: [] }).condition).toBe('CANCELLED');
  });
});

describe('civil billing dates', () => {
  it('uses Recife civil boundaries, including the UTC previous evening', () => {
    expect(recifeCivilDate(new Date('2026-01-15T02:59:59.999Z'))).toBe('2026-01-14');
    expect(recifeCivilDate(new Date('2026-01-15T03:00:00.000Z'))).toBe('2026-01-15');
    expect(addCivilDays('2026-01-01', 13)).toBe('2026-01-14');
    expect(recifeMidnight('2026-01-15').toISOString()).toBe('2026-01-15T03:00:00.000Z');
  });

  it('retains day 31 after a short February and resumes it when available', () => {
    expect(addAnchoredCivilMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addAnchoredCivilMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addAnchoredCivilMonths('2026-01-31', 3)).toBe('2026-04-30');
  });
});

describe('commercial access grace boundaries', () => {
  const renewal = { nature: 'RENEWAL', amount: new Prisma.Decimal('79.00'), dueDate: new Date('2026-09-15T00:00:00Z'), cancelledAt: null, settlements: [] };

  it.each([
    ['due date', '2026-09-15T23:59:59Z', 'ACCESS_ALLOWED'],
    ['first overdue day', '2026-09-16T03:00:00Z', 'PAYMENT_GRACE_PERIOD'],
    ['last grace day', '2026-09-20T03:00:00Z', 'PAYMENT_GRACE_PERIOD'],
    ['sixth day', '2026-09-21T03:00:00Z', 'PAYMENT_BLOCKED'],
  ])('%s derives the expected access', (_label, instant, expected) => {
    expect(deriveCommercialAccess([renewal], new Date(instant)).commercialAccess).toBe(expected);
  });

  it('does not unblock for a partial settlement', () => {
    expect(deriveCommercialAccess([{ ...renewal, settlements: [{ amount: new Prisma.Decimal('78.99') }] }], new Date('2026-09-21T03:00:00Z')).commercialAccess).toBe('PAYMENT_BLOCKED');
  });
});

describe('SubscriptionChargesService settlement rules', () => {
  it('rejects future receipts before opening a transaction', async () => {
    const subject = new SubscriptionChargesService({} as never, {} as never);
    await expect(subject.settle({} as never, 'charge', { amount: '1.00', receivedAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toBeInstanceOf(Error);
  });

  it('updates the first paid period atomically only on integral settlement after a partial payment', async () => {
    const initial = { id: 'charge', nature: 'FIRST_PAYMENT', amount: new Prisma.Decimal('79.00'), dueDate: new Date('2026-01-14T00:00:00Z'), cancelledAt: null, settlements: [{ amount: new Prisma.Decimal('30.00') }], subscription: { id: 'sub' }, commercialAccountId: 'account' } as any;
    const paid = { ...initial, settlements: [{ amount: new Prisma.Decimal('30.00') }, { amount: new Prisma.Decimal('49.00') }] };
    const tx = {
      subscriptionCharge: { update: jest.fn(), findUnique: jest.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(paid), findUniqueOrThrow: jest.fn().mockResolvedValue(paid) },
      chargeSettlement: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'settlement' }) },
      subscription: { findUnique: jest.fn().mockResolvedValue({ trialEnabled: true, trialEndsAt: new Date('2026-01-15T03:00:00Z') }), update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const subject = new SubscriptionChargesService(prisma, { record: jest.fn() } as never);

    await subject.settle({} as never, 'charge', { amount: '49.00', receivedAt: '2026-01-10T12:00:00.000Z', reason: 'Test backdate' });

    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sub' }, data: expect.objectContaining({ firstPaymentReceivedAt: new Date('2026-01-10T12:00:00.000Z'), firstPaidPeriodStartedAt: new Date('2026-01-15T03:00:00.000Z') }) }));
  });

  it('emits one first charge on trial day 10 and remains idempotent', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'charge-1' });
    const tx = { subscriptionCharge: { create }, auditEvent: {} };
    const prisma = {
      subscription: { findMany: jest.fn().mockResolvedValue([{ id: 'sub', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), trialStartsAt: new Date('2026-01-01T12:00:00Z') }]) },
      $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)),
    } as never;
    const audit = { record: jest.fn() };
    const subject = new SubscriptionChargesService(prisma, audit as never);

    await expect(subject.reconcileFirstPayments(new Date('2026-01-10T03:00:00.000Z'))).resolves.toMatchObject({ created: 1 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nature: 'FIRST_PAYMENT', dueDate: new Date('2026-01-14T03:00:00.000Z') }) }));
  });

  it('creates missing anchored renewal periods and records SYSTEM audit events', async () => {
    const creates: any[] = [];
    const tx = { subscriptionCharge: { create: jest.fn(async ({ data }) => { creates.push(data); return { id: `charge-${creates.length}` }; }) } };
    const prisma = {
      subscription: {
        findMany: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'sub', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstPaidPeriodStartedAt: new Date('2026-01-31T03:00:00Z'), effectiveCancellationAt: null }]),
      },
      $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)),
    } as never;
    const audit = { record: jest.fn() };
    const subject = new SubscriptionChargesService(prisma, audit as never);

    await expect(subject.reconcile(new Date('2026-04-15T03:00:00Z'))).resolves.toMatchObject({ created: 2 });
    expect(creates.map((charge) => [charge.billingPeriodStart.toISOString().slice(0, 10), charge.billingPeriodEnd.toISOString().slice(0, 10)])).toEqual([
      ['2026-02-28', '2026-03-31'], ['2026-03-31', '2026-04-30'],
    ]);
    expect(audit.record).toHaveBeenCalledWith(tx, null, expect.objectContaining({ after: expect.objectContaining({ system: true }) }));
  });

  it('treats a concurrent unique conflict as an idempotent success', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
    const tx = { subscriptionCharge: { create: jest.fn().mockRejectedValue(conflict) } };
    const prisma = { subscription: { findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'sub', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstPaidPeriodStartedAt: new Date('2026-01-01T03:00:00Z'), effectiveCancellationAt: null }]) }, $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const subject = new SubscriptionChargesService(prisma, { record: jest.fn() } as never);
    await expect(subject.reconcile(new Date('2026-02-02T03:00:00Z'))).resolves.toMatchObject({ created: 0, chargeIds: [] });
  });
});

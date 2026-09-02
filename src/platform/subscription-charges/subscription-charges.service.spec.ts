import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { deriveChargeCondition, SubscriptionChargesService } from './subscription-charges.service';
import { addCivilDays, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';

describe('deriveChargeCondition', () => {
  const charge = { amount: new Prisma.Decimal('100.00'), dueDate: new Date('2026-09-02T00:00:00Z'), cancelledAt: null, settlements: [] };
  it('keeps a charge pending through its civil due date and overdue on the following day', () => {
    expect(deriveChargeCondition(charge, new Date('2026-09-02T23:59:59Z'))).toMatchObject({ condition: 'PENDING', paidAmount: '0.00', outstandingAmount: '100.00' });
    expect(deriveChargeCondition(charge, new Date('2026-09-03T00:00:00Z')).condition).toBe('OVERDUE');
  });
  it('derives partial and paid using decimal-safe arithmetic', () => {
    expect(deriveChargeCondition({ ...charge, settlements: [{ amount: new Prisma.Decimal('33.33') }] })).toMatchObject({ condition: 'PARTIALLY_PAID', paidAmount: '33.33', outstandingAmount: '66.67' });
    expect(deriveChargeCondition({ ...charge, settlements: [{ amount: new Prisma.Decimal('33.33') }, { amount: new Prisma.Decimal('66.67') }] }).condition).toBe('PAID');
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
    const audit = { record: jest.fn() } as never;
    const subject = new SubscriptionChargesService(prisma, audit);

    await expect(subject.reconcileFirstPayments(new Date('2026-01-10T03:00:00.000Z'))).resolves.toMatchObject({ created: 1 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nature: 'FIRST_PAYMENT', dueDate: new Date('2026-01-14T03:00:00.000Z') }) }));
  });
});

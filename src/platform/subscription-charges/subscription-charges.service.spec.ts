import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { deriveChargeCondition, SubscriptionChargesService } from './subscription-charges.service';

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

describe('SubscriptionChargesService settlement rules', () => {
  it('rejects future receipts before opening a transaction', async () => {
    const subject = new SubscriptionChargesService({} as never, {} as never);
    await expect(subject.settle({} as never, 'charge', { amount: '1.00', receivedAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toBeInstanceOf(Error);
  });
});

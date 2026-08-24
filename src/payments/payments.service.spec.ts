import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

const principal = { role: 'ADMIN', organizationId: 'org' } as never;
const decimal = (value: string) => ({ toString: () => value });

function prismaFor(tx: unknown) {
  return { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
}

describe('PaymentsService', () => {
  it('persists pending Payments without applying them to the balance', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wo', status: 'OPEN' }]),
      workOrderItem: { findMany: jest.fn().mockResolvedValue([{ quantity: decimal('1'), unitPrice: decimal('10.00') }]) },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'payment', amount: decimal('100.00'), status: 'PENDING', method: 'PIX', paidAt: null }),
      },
    };
    const result = await new PaymentsService(prismaFor(tx)).create(principal, 'wo', { amount: '100.00', method: 'PIX', status: 'PENDING', paidAt: '2026-01-01T10:00:00.000Z' });
    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }));
    expect(result.financial).toMatchObject({ paid: '0.00', status: 'UNPAID' });
  });

  it('records a confirmed decimal Payment and derives PARTIAL without a WorkOrder status column', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wo', status: 'OPEN' }]),
      workOrderItem: { findMany: jest.fn().mockResolvedValue([{ quantity: decimal('1.000'), unitPrice: decimal('100.00') }]) },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'payment', amount: decimal('35.10'), status: 'CONFIRMED', method: 'PIX', paidAt: new Date('2026-01-01T10:00:00.000Z'), createdAt: new Date('2026-01-01T10:00:00.000Z') }),
      },
    };
    tx.payment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ amount: decimal('35.10') }]);

    const result = await new PaymentsService(prismaFor(tx)).create(principal, 'wo', { amount: '35.10', method: 'PIX', paidAt: '2026-01-01T10:00:00.000Z' });

    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org', workOrderId: 'wo', amount: '35.10', status: 'CONFIRMED' }) }));
    expect(result).toMatchObject({ amount: '35.10', financial: { total: '100.00', paid: '35.10', balance: '64.90', status: 'PARTIAL' } });
  });

  it('rejects a Payment that exceeds the balance using exact decimal arithmetic', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wo', status: 'OPEN' }]),
      workOrderItem: { findMany: jest.fn().mockResolvedValue([{ quantity: decimal('3.333'), unitPrice: decimal('10.10') }]) },
      payment: { findMany: jest.fn().mockResolvedValue([{ amount: decimal('33.65') }]), create: jest.fn() },
    };
    await expect(new PaymentsService(prismaFor(tx)).create(principal, 'wo', { amount: '0.02', method: 'CASH', paidAt: '2026-01-01T10:00:00.000Z' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('returns 404 for a WorkOrder outside the authenticated Organization', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await expect(new PaymentsService(prismaFor(tx)).list(principal, 'other-wo')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('cancels without deleting and recalculates the state to UNPAID', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wo', status: 'DELIVERED' }]),
      workOrderItem: { findMany: jest.fn().mockResolvedValue([{ quantity: decimal('1'), unitPrice: decimal('20.00') }]) },
      payment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'payment', status: 'CONFIRMED', amount: decimal('20.00') }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'payment', status: 'CANCELLED', amount: decimal('20.00') }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const result = await new PaymentsService(prismaFor(tx)).cancel(principal, 'wo', 'payment');
    expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { id: 'payment', organizationId: 'org', workOrderId: 'wo' }, data: { status: 'CANCELLED' } });
    expect(result.financial).toMatchObject({ paid: '0.00', balance: '20.00', status: 'UNPAID' });
  });
});

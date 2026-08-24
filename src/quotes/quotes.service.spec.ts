import { ConflictException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  it('rejects a customer and vehicle from different tenants before creating', async () => {
    const tx = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer' }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle', customerId: 'other-customer' }) },
    };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const service = new QuotesService(prisma);
    await expect(service.create({ role: 'ADMIN', organizationId: 'org' } as never, { customerId: 'customer', vehicleId: 'vehicle' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allocates the number from the organization counter inside the transaction', async () => {
    const tx = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer' }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle', customerId: 'customer' }) },
      organization: { update: jest.fn().mockResolvedValue({ nextQuoteNumber: 8 }) },
      quote: { create: jest.fn().mockResolvedValue({ id: 'quote', number: 7, items: [] }) },
    };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const service = new QuotesService(prisma);
    const result = await service.create({ role: 'ADMIN', organizationId: 'org' } as never, { customerId: 'customer', vehicleId: 'vehicle' });
    expect(tx.organization.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'org' }, data: { nextQuoteNumber: { increment: 1 } } }));
    expect(tx.quote.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ number: 7, organizationId: 'org' }) }));
    expect(result.total).toBe('0.00');
  });

  it.each([
    ['submit', 'DRAFT', 'PENDING'],
    ['approve', 'PENDING', 'APPROVED'],
    ['reject', 'PENDING', 'REJECTED'],
    ['cancel', 'DRAFT', 'CANCELLED'],
    ['cancel', 'PENDING', 'CANCELLED'],
  ] as const)('%s transitions a quote from %s to %s', async (action, currentStatus, nextStatus) => {
    const quote = { id: 'quote', organizationId: 'org', status: currentStatus, items: [] };
    const tx = {
      quote: {
        findFirst: jest.fn().mockResolvedValue(quote),
        update: jest.fn().mockResolvedValue({ ...quote, status: nextStatus }),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const service = new QuotesService(prisma);

    const result = await service[action]({ role: 'ADMIN', organizationId: 'org' } as never, 'quote');

    expect(tx.quote.update).toHaveBeenCalledWith({ where: { organizationId_id: { organizationId: 'org', id: 'quote' } }, data: { status: nextStatus }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    expect(result.status).toBe(nextStatus);
  });

  it.each([
    ['submit', 'PENDING'], ['submit', 'APPROVED'], ['submit', 'REJECTED'], ['submit', 'CANCELLED'],
    ['approve', 'DRAFT'], ['approve', 'APPROVED'], ['approve', 'REJECTED'], ['approve', 'CANCELLED'],
    ['reject', 'DRAFT'], ['reject', 'APPROVED'], ['reject', 'REJECTED'], ['reject', 'CANCELLED'],
    ['cancel', 'APPROVED'], ['cancel', 'REJECTED'], ['cancel', 'CANCELLED'],
  ] as const)('%s rejects a quote already/incompatibly in %s with stable conflict', async (action, currentStatus) => {
    const tx = { quote: { findFirst: jest.fn().mockResolvedValue({ id: 'quote', organizationId: 'org', status: currentStatus }) } };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const service = new QuotesService(prisma);

    await expect(service[action]({ role: 'ADMIN', organizationId: 'org' } as never, 'quote'))
      .rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'QUOTE_INVALID_TRANSITION' }) });
  });

  it('does not reveal a quote from another organization', async () => {
    const tx = { quote: { findFirst: jest.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const service = new QuotesService(prisma);

    await expect(service.submit({ role: 'ADMIN', organizationId: 'org' } as never, 'other-quote')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.quote.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other-quote', organizationId: 'org' } }));
  });
});

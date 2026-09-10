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

  it('selects workshop, customer, vehicle and items data for quote export', async () => {
    const quote = {
      id: 'quote',
      organizationId: 'org',
      customerId: 'customer',
      vehicleId: 'vehicle',
      number: 12,
      status: 'DRAFT',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      organization: {
        id: 'org', name: 'Oficina Central', document: '12345678000199', phone: '81999999999', email: 'oficina@example.com',
        addressLine1: 'Rua A', addressLine2: 'Sala 2', city: 'Recife', state: 'PE', postalCode: '50000-000',
      },
      customer: { id: 'customer', name: 'Cliente', document: '12345678909', phone: '81988888888', email: 'cliente@example.com' },
      vehicle: { id: 'vehicle', plate: 'ABC1D23', brand: 'Marca', model: 'Modelo', year: 2020 },
      items: [],
    };
    const prismaMock = { quote: { findFirst: jest.fn().mockResolvedValue(quote) } };
    const prisma = prismaMock as never;
    const service = new QuotesService(prisma);

    const result = await service.findOne({ role: 'ADMIN', organizationId: 'org' } as never, 'quote');

    expect(prismaMock.quote.findFirst).toHaveBeenCalledWith({
      where: { id: 'quote', organizationId: 'org' },
      select: expect.objectContaining({
        organization: { select: { id: true, name: true, document: true, phone: true, email: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true } },
        customer: { select: { id: true, name: true, document: true, phone: true, email: true } },
        vehicle: { select: { id: true, plate: true, brand: true, model: true, year: true } },
        items: { orderBy: { createdAt: 'asc' } },
      }),
    });
    expect(result).toMatchObject({ organization: quote.organization, customer: quote.customer, vehicle: quote.vehicle, items: [] });
  });

  it('does not reveal a quote from another organization in findOne', async () => {
    const prismaMock = { quote: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new QuotesService(prismaMock as never);

    await expect(service.findOne({ role: 'ADMIN', organizationId: 'org' } as never, 'other-quote')).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.quote.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other-quote', organizationId: 'org' } }));
  });
});

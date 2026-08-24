import { ConflictException, NotFoundException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  const prisma = {
    vehicle: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
    customer: { findFirst: jest.fn() },
    workOrder: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  } as any;
  const subject = new VehiclesService(prisma);
  const principal = { userId: 'user-a', sessionId: 'session-a', role: 'ADMIN', organizationId: 'org-a' } as any;

  beforeEach(() => jest.clearAllMocks());

  it('creates a Vehicle with normalized plate and tenant-scoped Customer', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'customer-a' });
    prisma.vehicle.create.mockResolvedValue({ id: 'vehicle-a', organizationId: 'org-a', customerId: 'customer-a', plate: 'ABC1D23' });
    await subject.create(principal, { customerId: 'customer-a', plate: 'abc-1d23', brand: 'Ford', model: 'Ka' } as any);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({ where: { id: 'customer-a', organizationId: 'org-a' }, select: { id: true } });
    expect(prisma.vehicle.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-a', plate: 'ABC1D23' }) }));
  });

  it('rejects a Customer from another Organization before creating', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(subject.create(principal, { customerId: 'customer-b', plate: 'ABC1234', brand: 'Ford', model: 'Ka' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.vehicle.create).not.toHaveBeenCalled();
  });

  it('maps duplicate plates to a conflict', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'customer-a' });
    prisma.vehicle.create.mockRejectedValue({ code: 'P2002' });
    await expect(subject.create(principal, { customerId: 'customer-a', plate: 'ABC1234', brand: 'Ford', model: 'Ka' } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('scopes listing and defaults to active Vehicles', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);
    await subject.list(principal, { page: 1, pageSize: 20, sort: 'plate', direction: 'asc' } as any);
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a', active: true } }));
  });

  it('rejects cross-tenant Customer changes before updating', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(subject.update(principal, 'vehicle-a', { customerId: 'customer-b' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.vehicle.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 for a Vehicle outside the tenant', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);
    await expect(subject.findOne(principal, 'vehicle-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'vehicle-b', organizationId: 'org-a' } }));
  });

  it('lists only completed or delivered Work Orders with the historical Customer', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-a' });
    prisma.$transaction.mockResolvedValue([[{
      id: 'work-order-a', organizationId: 'org-a', vehicleId: 'vehicle-a', customerId: 'former-customer',
      number: 7, status: 'COMPLETED', createdAt: new Date('2025-01-02T00:00:00Z'), updatedAt: new Date('2025-01-02T00:00:00Z'),
      customer: { id: 'former-customer', name: 'Former Customer' }, items: [{
        type: 'MANUAL', description: 'Inspection', quantity: { toString: () => '2.000' }, unitPrice: { toString: () => '12.34' },
      }],
    }], 1]);

    const result = await subject.history(principal, 'vehicle-a', { page: 1, pageSize: 10 } as any);

    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: 'vehicle-a', organizationId: 'org-a' }, select: { id: true } });
    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-a', vehicleId: 'vehicle-a', status: { in: ['COMPLETED', 'DELIVERED'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 0, take: 10,
    }));
    expect(result).toMatchObject({ meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } });
    expect(result.data[0]).toMatchObject({ customerId: 'former-customer', customer: { name: 'Former Customer' }, total: '24.68' });
  });

  it('returns 404 and never queries history for a Vehicle outside the tenant', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    await expect(subject.history(principal, 'vehicle-b', { page: 1, pageSize: 20 } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workOrder.findMany).not.toHaveBeenCalled();
  });
});

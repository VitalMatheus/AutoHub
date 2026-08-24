import { NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  const prisma = {
    service: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
  const subject = new ServicesService(prisma);
  const principal = { userId: 'user-a', sessionId: 'session-a', role: 'ADMIN', organizationId: 'org-a' } as any;

  beforeEach(() => jest.clearAllMocks());

  it('creates a Service using the principal organization and an exact decimal string', async () => {
    prisma.service.create.mockResolvedValue({ id: 'service-a', organizationId: 'org-a', name: 'Oil change', price: '149.90', active: true });

    const result = await subject.create(principal, { name: ' Oil change ', price: '149.90' } as any);

    expect(prisma.service.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { organizationId: 'org-a', name: 'Oil change', price: '149.90' },
    }));
    expect(result.price).toBe('149.90');
  });

  it('defaults listing to active Services and scopes every query to the tenant', async () => {
    prisma.service.findMany.mockResolvedValue([]);
    prisma.service.count.mockResolvedValue(1);
    prisma.$transaction.mockResolvedValue([[{ id: 'service-a', price: '10.00' }], 1]);

    await subject.list(principal, { page: 1, pageSize: 20, sort: 'name', direction: 'asc' } as any);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a', active: true } }));
    expect(prisma.service.count).toHaveBeenCalledWith({ where: { organizationId: 'org-a', active: true } });
  });

  it('does not expose a Service from another organization', async () => {
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(subject.findOne(principal, 'service-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.service.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'service-b', organizationId: 'org-a' },
    }));
  });
});

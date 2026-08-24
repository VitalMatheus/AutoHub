import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const prisma = {
    product: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
  const subject = new ProductsService(prisma);
  const principal = { userId: 'user-a', sessionId: 'session-a', role: 'ADMIN', organizationId: 'org-a' } as any;

  beforeEach(() => jest.clearAllMocks());

  it('creates a Product using the principal organization and an exact decimal string', async () => {
    prisma.product.create.mockResolvedValue({ id: 'product-a', organizationId: 'org-a', name: 'Oil filter', sku: 'OF-001', salePrice: '149.90', active: true });

    const result = await subject.create(principal, { name: ' Oil filter ', sku: ' of-001 ', salePrice: '149.90', organizationId: 'org-b' } as any);

    expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { organizationId: 'org-a', name: 'Oil filter', sku: 'OF-001', salePrice: '149.90' },
    }));
    expect(result.salePrice).toBe('149.90');
  });

  it('maps a duplicate SKU to a conflict', async () => {
    prisma.product.create.mockRejectedValue({ code: 'P2002' });

    await expect(subject.create(principal, { name: 'Oil filter', sku: 'OF-001', salePrice: '10.00' } as any))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('defaults listing to active Products and scopes every query to the tenant', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(1);
    prisma.$transaction.mockResolvedValue([[{ id: 'product-a', salePrice: '10.00' }], 1]);

    await subject.list(principal, { page: 1, pageSize: 20, sort: 'name', direction: 'asc' } as any);

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a', active: true } }));
    expect(prisma.product.count).toHaveBeenCalledWith({ where: { organizationId: 'org-a', active: true } });
  });

  it('does not expose a Product from another organization', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(subject.findOne(principal, 'product-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-b', organizationId: 'org-a' },
    }));
  });
});

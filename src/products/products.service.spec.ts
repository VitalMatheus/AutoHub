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
    $queryRaw: jest.fn(),
  } as any;
  const subject = new ProductsService(prisma);
  const principal = { userId: 'user-a', sessionId: 'session-a', role: 'ADMIN', organizationId: 'org-a' } as any;

  beforeEach(() => jest.clearAllMocks());

  it('creates a Product using the principal organization and an exact decimal string', async () => {
    prisma.product.create.mockResolvedValue({ id: 'product-a', organizationId: 'org-a', name: 'Oil filter', sku: 'OF-001', salePrice: '149.90', stockQuantity: 4, stockMinimum: 2, active: true });

    const result = await subject.create(principal, { name: ' Oil filter ', sku: ' of-001 ', salePrice: '149.90', organizationId: 'org-b' } as any);

    expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { organizationId: 'org-a', name: 'Oil filter', sku: 'OF-001', salePrice: '149.90', stockQuantity: 0, stockMinimum: 0 },
    }));
    expect(result.salePrice).toBe('149.90');
  });

  it('generates a SKU and exposes the low-stock status', async () => {
    prisma.product.create.mockImplementation(async ({ data }: any) => ({ id: 'product-a', ...data, salePrice: '10.00', active: true }));

    const result = await subject.create(principal, { name: 'Oil filter', salePrice: '10.00', stockQuantity: 2, stockMinimum: 3 } as any);

    expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sku: expect.stringMatching(/^PROD-/), stockQuantity: 2, stockMinimum: 3 }) }));
    expect(result).toMatchObject({ stockQuantity: 2, stockMinimum: 3, lowStock: true });
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

  it('filters Products with low stock in the tenant', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'product-a' }]);
    prisma.$transaction.mockResolvedValue([[{ id: 'product-a', salePrice: '10.00', stockQuantity: 1, stockMinimum: 2 }], 1]);

    const result = await subject.list(principal, { page: 1, pageSize: 20, lowStock: true } as any);

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a', active: true, id: { in: ['product-a'] } } }));
    expect(result.data[0]).toMatchObject({ lowStock: true });
  });

  it('updates stock directly while preserving tenant isolation', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findFirst.mockResolvedValue({ id: 'product-a', organizationId: 'org-a', salePrice: '10.00', stockQuantity: 7, stockMinimum: 2, active: true });

    await subject.update(principal, 'product-a', { stockQuantity: 7 } as any);

    expect(prisma.product.updateMany).toHaveBeenCalledWith({ where: { id: 'product-a', organizationId: 'org-a' }, data: { stockQuantity: 7 } });
  });

  it('does not expose a Product from another organization', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(subject.findOne(principal, 'product-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-b', organizationId: 'org-a' },
    }));
  });
});

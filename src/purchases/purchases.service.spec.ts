import { ConflictException } from '@nestjs/common';
import { PurchasesService } from './purchases.service';

describe('PurchasesService', () => {
  const principal = { role: 'ADMIN', organizationId: 'org-a' } as any;
  it('does not trust a client organization and creates draft snapshots', async () => {
    const tx: any = { purchase: { create: jest.fn().mockResolvedValue({ id: 'purchase-a' }), findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'purchase-a', supplier: { id: 'supplier-a', name: 'Supplier' }, items: [{ unitCost: '10.00', quantity: 2 }], purchaseDate: new Date('2026-01-01'), dueDate: new Date('2026-01-10'), status: 'DRAFT' }) }, purchaseItem: { createMany: jest.fn() } };
    const prisma: any = { supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'supplier-a' }) }, product: { findMany: jest.fn().mockResolvedValue([{ id: 'product-a', name: 'Oil', sku: 'OIL-1' }]) }, $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const result = await new PurchasesService(prisma).create(principal, { organizationId: 'other-org', supplierId: 'supplier-a', purchaseDate: '2026-01-01', dueDate: '2026-01-10', items: [{ productId: 'product-a', quantity: 2, unitCost: '10.00' }] } as any);
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'supplier-a', organizationId: 'org-a', active: true } }));
    expect(tx.purchase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-a' }) }));
    expect(result.total).toBe('20.00');
  });

  it('confirms purchase atomically with payable and stock entries', async () => {
    const tx: any = { purchase: { findFirst: jest.fn().mockResolvedValue({ id: 'p', supplierId: 's', purchaseDate: new Date('2026-01-01'), items: [{ id: 'i', productId: 'prod', quantity: 3, unitCost: '12.50', productName: 'Oil', sku: 'OIL' }] }), update: jest.fn().mockResolvedValue({ id: 'p', status: 'CONFIRMED', supplier: { id: 's', name: 'Supplier' }, items: [{ unitCost: '12.50', quantity: 3 }], stockEntries: [], purchaseDate: new Date('2026-01-01'), dueDate: new Date('2026-01-10') }) }, expense: { create: jest.fn().mockResolvedValue({ id: 'expense' }) }, expensePayment: { create: jest.fn() }, product: { update: jest.fn() }, stockEntry: { create: jest.fn() } };
    tx.purchase.findFirst.mockResolvedValueOnce({ id: 'p', supplierId: 's', status: 'DRAFT', purchaseDate: new Date('2026-01-01'), dueDate: new Date('2026-01-10'), items: [{ id: 'i', productId: 'prod', quantity: 3, unitCost: '12.50', productName: 'Oil', sku: 'OIL' }] });
    const prisma: any = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const result = await new PurchasesService(prisma).confirm(principal, 'p');
    expect(tx.expense.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: 'PARTS_AND_SUPPLIES' }) }));
    expect(tx.expense.create.mock.calls[0][0].data.amount.toString()).toBe('37.5');
    const expensePayment = tx.expensePayment.create.mock.calls[0][0].data;
    expect(expensePayment).toMatchObject({ expenseId: 'expense', method: 'OTHER', status: 'CONFIRMED' });
    expect(expensePayment.amount.toString()).toBe('37.5');
    expect(expensePayment.paidAt).toEqual(new Date('2026-01-10'));
    expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_id: { organizationId: 'org-a', id: 'prod' } } }));
    expect(tx.stockEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-a', supplierId: 's', quantity: 3 }) }));
    expect(result.status).toBe('CONFIRMED');
  });

  it('rejects cancellation after stock consumption', async () => {
    const tx: any = { purchase: { findFirst: jest.fn().mockResolvedValue({ status: 'CONFIRMED', stockEntries: [{ consumedQuantity: 1 }], expense: { payments: [] } }) } };
    await expect(new PurchasesService({ $transaction: (fn: any) => fn(tx) } as any).cancel(principal, 'p')).rejects.toBeInstanceOf(ConflictException);
  });
});

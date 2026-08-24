import { WorkOrdersService } from './work-orders.service';

const principal = { role: 'ADMIN', organizationId: 'org' } as never;
const decimal = (value: string) => ({ toString: () => value });

describe('WorkOrdersService hardening', () => {
  it('uses catalog prices and supports tenant-scoped item maintenance before completion', async () => {
    const current = { id: 'wo', status: 'OPEN', items: [] };
    const tx = {
      workOrder: { findFirst: jest.fn().mockResolvedValue(current), findFirstOrThrow: jest.fn().mockResolvedValue({ ...current, items: [] }) },
      workOrderItem: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue({ id: 'item', workOrderId: 'wo', organizationId: 'org', type: 'SERVICE', serviceId: 'service', productId: null, description: 'Old', quantity: decimal('1'), unitPrice: decimal('10.00') }), updateMany: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      service: { findFirst: jest.fn().mockResolvedValue({ id: 'service', name: 'Brake', description: 'Brake service', price: decimal('100.00') }) },
    };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)), workOrder: { findFirst: jest.fn().mockResolvedValue({ ...current, items: [] }) } } as never;
    const service = new WorkOrdersService(prisma);
    await service.addItem(principal, 'wo', { type: 'SERVICE', serviceId: 'service', quantity: '1', unitPrice: '1.00' });
    expect(tx.workOrderItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org', workOrderId: 'wo', unitPrice: '100.00' }) }));
    await service.updateItem(principal, 'wo', 'item', { quantity: '2' });
    expect(tx.workOrderItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'item', workOrderId: 'wo', organizationId: 'org' } }));
    await service.removeItem(principal, 'wo', 'item');
    expect(tx.workOrderItem.deleteMany).toHaveBeenCalledWith({ where: { id: 'item', workOrderId: 'wo', organizationId: 'org' } });
  });
});

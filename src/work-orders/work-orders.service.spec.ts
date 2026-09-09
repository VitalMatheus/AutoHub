import { ConflictException, NotFoundException } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';

const principal = { role: 'ADMIN', organizationId: 'org' } as never;

describe('WorkOrdersService', () => {
  it('resolves Customer and Vehicle in the authenticated Organization and allocates atomically', async () => {
    const tx = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer' }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle', customerId: 'customer' }) },
      organization: { update: jest.fn().mockResolvedValue({ nextWorkOrderNumber: 4 }) },
      workOrder: {
        create: jest.fn().mockResolvedValue({ id: 'wo', number: 3 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wo', number: 3, items: [] }),
      },
    };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;
    const service = new WorkOrdersService(prisma);
    const result = await service.create(principal, { customerId: 'customer', vehicleId: 'vehicle' });
    expect(tx.organization.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'org' }, data: { nextWorkOrderNumber: { increment: 1 } } }));
    expect(tx.workOrder.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org', number: 3 }) }));
    expect(result.total).toBe('0.00');
  });

  it('rejects cross-organization customer/vehicle links', async () => {
    const tx = { customer: { findFirst: jest.fn().mockResolvedValue(null) }, vehicle: { findFirst: jest.fn() } };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;
    await expect(new WorkOrdersService(prisma).create(principal, { customerId: 'other', vehicleId: 'vehicle' })).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other', organizationId: 'org', active: true } }));
  });

  it('preserves exact item snapshots and calculates decimal totals', async () => {
    const tx = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer' }) }, vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle', customerId: 'customer' }) },
      organization: { update: jest.fn().mockResolvedValue({ nextWorkOrderNumber: 2 }) },
      service: { findFirst: jest.fn().mockResolvedValue({ id: 'service', name: 'Brake', description: 'Brake service', price: { toString: () => '100.00' } }) },
      workOrder: { create: jest.fn().mockResolvedValue({ id: 'wo' }), findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wo', items: [{ type: 'SERVICE', description: 'Brake service', quantity: { toString: () => '1.250' }, unitPrice: { toString: () => '12.34' } }] }) },
      workOrderItem: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;
    const result = await new WorkOrdersService(prisma).create(principal, { customerId: 'customer', vehicleId: 'vehicle', items: [{ type: 'SERVICE', serviceId: 'service', quantity: '1.250', unitPrice: '12.34' }] });
    expect(tx.workOrderItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ description: 'Brake service', quantity: '1.250', unitPrice: '100.00' }) }));
    expect(result.items[0]).toMatchObject({ description: 'Brake service', quantity: '1.250', unitPrice: '12.34', total: '15.43' });
  });

  it.each([
    ['requestApproval', 'OPEN', 'WAITING_APPROVAL'], ['start', 'WAITING_APPROVAL', 'IN_PROGRESS'], ['waitParts', 'IN_PROGRESS', 'WAITING_PARTS'], ['complete', 'IN_PROGRESS', 'COMPLETED'], ['deliver', 'COMPLETED', 'DELIVERED'], ['cancel', 'OPEN', 'CANCELLED'],
  ] as const)('transitions %s', async (action, status, next) => {
    const current = { id: 'wo', organizationId: 'org', status, items: [] };
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'wo' }]), workOrder: { findFirst: jest.fn().mockResolvedValue(current), findFirstOrThrow: jest.fn().mockResolvedValue({ ...current, status: next, stockAllocations: [] }), update: jest.fn().mockResolvedValue({ ...current, status: next }) }, product: { update: jest.fn() }, stockMovement: { create: jest.fn() }, workOrderStockAllocation: { create: jest.fn() } };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;
    const result = await new WorkOrdersService(prisma)[action](principal, 'wo');
    expect(result.status).toBe(next);
  });

  it('consumes the final Product composition atomically on completion and reports insufficient Products', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ id: 'wo' }])
        .mockResolvedValueOnce([{ id: 'product', name: 'Oil', stockQuantity: 1 }]),
      workOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'wo', status: 'IN_PROGRESS', items: [{ type: 'PRODUCT', productId: 'product', quantity: { toString: () => '2' } }] }) },
      product: { update: jest.fn(), }, stockMovement: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;
    await expect(new WorkOrdersService(prisma).complete(principal, 'wo')).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'INSUFFICIENT_STOCK', products: ['Oil'] }) });
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('completes explicit and automatic stock allocations together', async () => {
    const tx = {
      stockEntry: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ id: 'entry-b', productId: 'product-1', quantity: 1, consumedQuantity: 0, status: 'AVAILABLE', unitCost: '120.00', purchase: { status: 'CONFIRMED' } }])
          .mockResolvedValueOnce([{ id: 'entry-a', productId: 'product-2', quantity: 1, consumedQuantity: 0, status: 'AVAILABLE', unitCost: '80.00', purchase: { status: 'CONFIRMED' } }]),
      },
    };
    const service = new WorkOrdersService({} as never);
    const resolveRequestedAllocations = (Reflect.get(service, 'resolveRequestedAllocations') as (...args: unknown[]) => Promise<Array<{ workOrderItemId: string; stockEntryId?: string }>>).bind(service);
    const result = await resolveRequestedAllocations(
      tx,
      'org',
      [
        { id: 'item-1', type: 'PRODUCT', productId: 'product-1', quantity: { toString: () => '1' } },
        { id: 'item-2', type: 'PRODUCT', productId: 'product-2', quantity: { toString: () => '1' } },
      ],
      [{ workOrderItemId: 'item-1', stockEntryId: 'entry-b', quantity: 1 }],
      new Map([['product-1', 1], ['product-2', 1]]),
    );
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ workOrderItemId: 'item-1', stockEntryId: 'entry-b', quantity: 1 }),
      expect.objectContaining({ workOrderItemId: 'item-2', stockEntryId: 'entry-a', quantity: 1 }),
    ]));
  });

  it('returns a stable conflict for invalid transitions', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'wo' }]), workOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'wo', organizationId: 'org', status: 'DELIVERED', items: [] }) } };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;
    await expect(new WorkOrdersService(prisma).complete(principal, 'wo')).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'WORK_ORDER_INVALID_TRANSITION' }) });
  });

  it('converts an approved Quote into an independent Work Order in one transaction', async () => {
    const quote = {
      id: 'quote', organizationId: 'org', customerId: 'customer', vehicleId: 'vehicle',
      status: 'APPROVED', notes: 'Use synthetic oil', items: [
        { type: 'SERVICE', serviceId: 'service', productId: null, description: 'Brake service', quantity: '1.500', unitPrice: '12.34' },
        { type: 'MANUAL', serviceId: null, productId: null, description: 'Inspection', quantity: '2.000', unitPrice: '3.21' },
      ],
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'quote' }]),
      workOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'wo', number: 3 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wo', number: 3, status: 'OPEN', items: [
          { ...quote.items[0], quantity: { toString: () => '1.500' }, unitPrice: { toString: () => '12.34' } },
          { ...quote.items[1], quantity: { toString: () => '2.000' }, unitPrice: { toString: () => '3.21' } },
        ] }),
      },
      quote: { findFirst: jest.fn().mockResolvedValue(quote) },
      organization: { update: jest.fn().mockResolvedValue({ nextWorkOrderNumber: 4 }) },
      workOrderItem: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;

    const result = await new WorkOrdersService(prisma).convertApprovedQuote(principal, 'quote');

    expect(tx.organization.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'org' }, data: { nextWorkOrderNumber: { increment: 1 } } }));
    expect(tx.workOrder.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org', quoteId: 'quote', customerId: 'customer', vehicleId: 'vehicle', number: 3 }) }));
    expect(tx.workOrderItem.create).toHaveBeenCalledTimes(2);
    expect(tx.workOrderItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org', workOrderId: 'wo', description: 'Brake service', quantity: '1.500', unitPrice: '12.34' }) }));
    expect(result.total).toBe('24.93');
  });

  it('rejects a Quote that is not approved with a stable conflict', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'quote' }]), workOrder: { findFirst: jest.fn().mockResolvedValue(null) }, quote: { findFirst: jest.fn().mockResolvedValue({ id: 'quote', organizationId: 'org', status: 'PENDING', items: [] }) } };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;
    await expect(new WorkOrdersService(prisma).convertApprovedQuote(principal, 'quote')).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'QUOTE_NOT_APPROVED' }) });
  });

  it('rejects a repeated conversion with a stable conflict', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'quote' }]), workOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'existing', quoteId: 'quote' }) } };
    const prisma = { $transaction: jest.fn((cb: (value: unknown) => unknown) => cb(tx)) } as never;
    await expect(new WorkOrdersService(prisma).convertApprovedQuote(principal, 'quote')).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'QUOTE_ALREADY_CONVERTED' }) });
  });

  it('filters financial Work Orders by confirmed payment state before paginating', async () => {
    const row = (id: string, amount: string, paymentAmount?: string) => ({
      id,
      organizationId: 'org',
      number: Number(id.slice(-1)),
      status: 'COMPLETED',
      customer: { name: 'Customer' },
      vehicle: { plate: 'ABC1D23', brand: 'Toyota', model: 'Corolla' },
      items: [{ type: 'MANUAL', description: 'Service', quantity: '1.000', unitPrice: amount }],
      payments: paymentAmount ? [{ amount: paymentAmount, status: 'CONFIRMED' }] : [],
    });
    const findMany = jest.fn().mockResolvedValue([row('wo-1', '100.00'), row('wo-2', '100.00', '35.00'), row('wo-3', '100.00', '100.00')]);
    const prisma = { workOrder: { findMany } } as never;

    const result = await new WorkOrdersService(prisma).listFinancial(principal, { financialStatus: 'PARTIAL', page: 1, pageSize: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: 'wo-2', financial: { status: 'PARTIAL', paid: '35.00' } });
    expect(result.meta).toMatchObject({ total: 1, totalPages: 1 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org' } }));

    const defaultResult = await new WorkOrdersService(prisma).listFinancial(principal, { page: 1, pageSize: 10 });
    expect(defaultResult.data.map((entry) => entry.id)).toEqual(['wo-1', 'wo-2', 'wo-3']);
  });
});

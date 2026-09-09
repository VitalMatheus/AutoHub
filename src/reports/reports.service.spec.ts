import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

const d = (value: string) => new Prisma.Decimal(value);
const principal = { role: 'ADMIN', organizationId: 'org-a' } as never;

describe('ReportsService', () => {
  it('keeps confirmed cash movements separate from receivables and payables', async () => {
    const prisma: any = {
      payment: { findMany: jest.fn().mockResolvedValue([{ amount: d('100.00'), paidAt: new Date('2026-09-10'), workOrderId: 'wo' }]) },
      salePayment: { findMany: jest.fn().mockResolvedValue([{ amount: d('50.00'), paidAt: new Date('2026-09-11'), directSaleId: 'sale' }]) },
      expensePayment: { findMany: jest.fn().mockResolvedValue([{ amount: d('30.00'), paidAt: new Date('2026-09-12'), expense: { category: 'RENT' } }]) },
      workOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'wo', number: 1, status: 'COMPLETED', items: [{ type: 'SERVICE', quantity: d('1'), unitPrice: d('200.00') }], payments: [{ amount: d('100.00'), discount: d('0.00') }], stockAllocations: [] }]) },
      directSale: { findMany: jest.fn().mockResolvedValue([{ id: 'sale', number: 2, status: 'CONFIRMED', items: [{ quantity: 1, unitPrice: d('50.00'), discount: d('0.00') }], payments: [{ amount: d('50.00') }], stockAllocations: [] }]) },
      expense: { findMany: jest.fn().mockResolvedValue([{ id: 'expense', description: 'Rent', category: 'RENT', amount: d('100.00'), dueDate: new Date('2026-09-20'), payments: [{ amount: d('30.00') }] }]) },
    };
    const result = await new ReportsService(prisma).managerial(principal, { from: '2026-09-01', to: '2026-09-30' });
    expect(result.revenue).toEqual({ workOrders: '100.00', directSales: '50.00', total: '150.00' });
    expect(result.realizedExpenses.total).toBe('30.00');
    expect(result.cashResult).toBe('120.00');
    expect(result.accountsReceivable).toEqual([{ source: 'WORK_ORDER', id: 'wo', number: 1, balance: '100.00' }]);
    expect(result.accountsPayable).toEqual([{ id: 'expense', description: 'Rent', category: 'RENT', dueDate: '2026-09-20', balance: '70.00' }]);
    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-a' }) }));
  });

  it('considers confirmed work order discounts in receivables without changing realized revenue', async () => {
    const prisma: any = {
      payment: { findMany: jest.fn().mockResolvedValue([{ amount: d('80.00'), paidAt: new Date('2026-09-10'), workOrderId: 'wo-paid' }]) },
      salePayment: { findMany: jest.fn().mockResolvedValue([]) },
      expensePayment: { findMany: jest.fn().mockResolvedValue([]) },
      workOrder: { findMany: jest.fn().mockResolvedValue([
        { id: 'wo-paid', number: 7, status: 'COMPLETED', items: [{ type: 'SERVICE', quantity: d('1'), unitPrice: d('100.00') }], payments: [{ amount: d('80.00'), discount: d('20.00') }], stockAllocations: [] },
      ]) },
      directSale: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const result = await new ReportsService(prisma).managerial(principal, { from: '2026-09-01', to: '2026-09-30' });

    expect(result.revenue).toEqual({ workOrders: '80.00', directSales: '0.00', total: '80.00' });
    expect(result.accountsReceivable).toEqual([]);
    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-a' }),
    }));
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-a' }),
    }));
  });

  it('rejects a Super Admin and always scopes every read to its Organization', async () => {
    const prisma: any = { payment: { findMany: jest.fn() } };
    await expect(new ReportsService(prisma).managerial({ role: 'SUPER_ADMIN', organizationId: null } as never, {})).rejects.toBeInstanceOf(ForbiddenException);
  });
});

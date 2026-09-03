import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

const principal = { role: 'ADMIN', organizationId: 'org' } as never;
const decimal = (value: string) => ({ toString: () => value });

function prismaFor(tx: unknown) {
  return { ...(tx as object), $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
}

describe('ExpensesService', () => {
  it('creates an Expense in the authenticated Organization and derives an unpaid balance', async () => {
    const tx = {
      expense: {
        create: jest.fn().mockResolvedValue({ id: 'expense', organizationId: 'org', category: 'RENT', description: 'Aluguel', amount: decimal('1200.00'), dueDate: new Date('2026-01-10'), status: 'OPEN', payments: [] }),
        findFirst: jest.fn().mockResolvedValue({ id: 'expense', organizationId: 'org', category: 'RENT', description: 'Aluguel', amount: decimal('1200.00'), dueDate: new Date('2026-01-10'), status: 'OPEN', payments: [] }),
      },
    };
    const result = await new ExpensesService(prismaFor(tx)).create(principal, { category: 'RENT', description: 'Aluguel', amount: '1200.00', dueDate: '2026-01-10' });
    expect(tx.expense.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org', amount: '1200.00', category: 'RENT' }) }));
    expect(result).toMatchObject({ amount: '1200.00', balance: '1200.00', financialStatus: 'UNPAID' });
  });

  it('derives partial and paid from confirmed Expense payments only', async () => {
    const tx = {
      expense: { findFirst: jest.fn().mockResolvedValue({ id: 'expense', organizationId: 'org', category: 'UTILITIES', description: 'Luz', amount: decimal('100.00'), dueDate: new Date('2026-01-10'), status: 'OPEN', payments: [{ amount: decimal('35.10'), status: 'CONFIRMED' }, { amount: decimal('20.00'), status: 'PENDING' }] }) },
    };
    const result = await new ExpensesService(prismaFor(tx)).findOne(principal, 'expense');
    expect(result).toMatchObject({ paid: '35.10', balance: '64.90', financialStatus: 'PARTIAL' });
  });

  it('rejects a confirmed Expense payment above the exact remaining balance', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'expense', status: 'OPEN' }]),
      expense: { findFirst: jest.fn().mockResolvedValue({ id: 'expense', amount: decimal('100.00') }), findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'expense', amount: decimal('100.00'), payments: [] }) },
      expensePayment: { findMany: jest.fn().mockResolvedValue([{ amount: decimal('99.99'), status: 'CONFIRMED' }]), create: jest.fn() },
    };
    await expect(new ExpensesService(prismaFor(tx)).createPayment(principal, 'expense', { amount: '0.02', method: 'PIX', paidAt: '2026-01-01T10:00:00.000Z' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.expensePayment.create).not.toHaveBeenCalled();
  });

  it('does not allow editing or cancelling an Expense after a confirmed payment', async () => {
    const tx = {
      expense: { findFirst: jest.fn().mockResolvedValue({ id: 'expense', status: 'OPEN', payments: [{ status: 'CONFIRMED' }] }), updateMany: jest.fn(), findFirstOrThrow: jest.fn() },
    };
    const service = new ExpensesService(prismaFor(tx));
    await expect(service.update(principal, 'expense', { description: 'Novo' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.cancel(principal, 'expense')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.expense.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 when an Expense belongs to another Organization', async () => {
    const tx = { expense: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new ExpensesService(prismaFor(tx)).findOne(principal, 'other-expense')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.expense.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other-expense', organizationId: 'org' } }));
  });
});

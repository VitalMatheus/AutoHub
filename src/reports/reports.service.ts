import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { ManagerialReportQueryDto } from './dto/managerial-report-query.dto';

const zero = () => new Prisma.Decimal(0);
const add = (a: Prisma.Decimal, b: Prisma.Decimal) => a.add(b);
const money = (value: Prisma.Decimal) => value.toFixed(2);
const cents = (value: Prisma.Decimal | string | number) => new Prisma.Decimal(value.toString());
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
const nextDay = (date: string) => new Date(day(date).getTime() + 86400000);
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}
  private tenant(p: AuthenticatedPrincipal) { if (p.role !== 'ADMIN' || !p.organizationId) throw new ForbiddenException('Organization Admin access required'); return p.organizationId; }

  private period(query: ManagerialReportQueryDto) {
    const now = new Date(); const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const from = query.from ? day(query.from) : defaultFrom;
    const toText = query.to ?? dateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
    const to = nextDay(toText);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new BadRequestException('from must be before or equal to to');
    return { from, to, fromText: dateOnly(from), toText: dateOnly(new Date(to.getTime() - 86400000)) };
  }

  async managerial(principal: AuthenticatedPrincipal, query: ManagerialReportQueryDto = {}) {
    const organizationId = this.tenant(principal); const period = this.period(query);
    const [payments, salePayments, expensePayments, workOrders, sales, expenses] = await Promise.all([
      this.prisma.payment.findMany({ where: { organizationId, status: 'CONFIRMED', paidAt: { gte: period.from, lt: period.to }, workOrder: { status: { not: 'CANCELLED' } } }, select: { amount: true, paidAt: true, workOrderId: true }, orderBy: { paidAt: 'asc' } }),
      this.prisma.salePayment.findMany({ where: { organizationId, status: 'CONFIRMED', paidAt: { gte: period.from, lt: period.to }, directSale: { status: { not: 'CANCELLED' } } }, select: { amount: true, paidAt: true, directSaleId: true }, orderBy: { paidAt: 'asc' } }),
      this.prisma.expensePayment.findMany({ where: { organizationId, status: 'CONFIRMED', paidAt: { gte: period.from, lt: period.to }, expense: { status: { not: 'CANCELLED' } } }, select: { amount: true, paidAt: true, expense: { select: { category: true } } }, orderBy: { paidAt: 'asc' } }),
      this.prisma.workOrder.findMany({ where: { organizationId, status: { not: 'CANCELLED' } }, select: { id: true, number: true, status: true, items: { select: { type: true, quantity: true, unitPrice: true }, }, payments: { where: { status: 'CONFIRMED' }, select: { amount: true } }, stockAllocations: { select: { quantity: true, unitCost: true } } } }),
      this.prisma.directSale.findMany({ where: { organizationId, status: { not: 'CANCELLED' } }, select: { id: true, number: true, status: true, items: { select: { quantity: true, unitPrice: true, discount: true } }, payments: { where: { status: 'CONFIRMED' }, select: { amount: true } }, stockAllocations: { select: { quantity: true, unitCost: true } } } }),
      this.prisma.expense.findMany({ where: { organizationId, status: { not: 'CANCELLED' } }, select: { id: true, description: true, category: true, amount: true, dueDate: true, payments: { where: { status: 'CONFIRMED' }, select: { amount: true } } } }),
    ]);
    const workRevenue = payments.reduce((s, x) => add(s, cents(x.amount)), zero());
    const saleRevenue = salePayments.reduce((s, x) => add(s, cents(x.amount)), zero());
    const expenseTotal = expensePayments.reduce((s, x) => add(s, cents(x.amount)), zero());
    const byCategory = new Map<string, Prisma.Decimal>(); for (const p of expensePayments) byCategory.set(p.expense.category, add(byCategory.get(p.expense.category) ?? zero(), cents(p.amount)));
    const receivable = [
      ...workOrders.map((x) => ({ source: 'WORK_ORDER', id: x.id, number: x.number, balance: add(x.items.reduce((s, i) => add(s, cents(i.quantity).mul(i.unitPrice)), zero()), x.payments.reduce((s, p) => add(s, cents(p.amount).neg()), zero())) })),
      ...sales.map((x) => ({ source: 'DIRECT_SALE', id: x.id, number: x.number, balance: add(x.items.reduce((s, i) => add(s, cents(i.quantity).mul(i.unitPrice).sub(i.discount)), zero()), x.payments.reduce((s, p) => add(s, cents(p.amount).neg()), zero())) })),
    ].filter((x) => x.balance.gt(0)).map((x) => ({ ...x, balance: money(x.balance) }));
    const payable = expenses.map((x) => ({ ...x, balance: x.amount.sub(x.payments.reduce((s, p) => add(s, cents(p.amount)), zero())) })).filter((x) => x.balance.gt(0)).map((x) => ({ id: x.id, description: x.description, category: x.category, dueDate: dateOnly(x.dueDate), balance: money(x.balance) }));
    const parts = [...workOrders.flatMap((x) => x.items.filter((i) => i.type === 'PRODUCT').map((i) => cents(i.quantity).mul(i.unitPrice))), ...sales.flatMap((x) => x.items.map((i) => cents(i.quantity).mul(i.unitPrice).sub(i.discount)))].reduce((s, x) => add(s, x), zero());
    const realizedWorkIds = new Set(payments.map((x) => x.workOrderId)); const realizedSaleIds = new Set(salePayments.map((x) => x.directSaleId));
    const realizedAllocations = [...workOrders.filter((x) => realizedWorkIds.has(x.id)).flatMap((x) => x.stockAllocations), ...sales.filter((x) => realizedSaleIds.has(x.id)).flatMap((x) => x.stockAllocations)];
    const costs = realizedAllocations.filter((x) => x.unitCost !== null).reduce((s, x) => add(s, cents(x.unitCost!).mul(x.quantity)), zero());
    const traceable = realizedAllocations.some((x) => x.unitCost !== null);
    const revenue = add(workRevenue, saleRevenue); const cash = revenue.sub(expenseTotal);
    const months = this.months(period.from, period.to, payments, salePayments, expensePayments);
    return { from: period.fromText, to: period.toText, timezone: 'America/Recife', revenue: { workOrders: money(workRevenue), directSales: money(saleRevenue), total: money(revenue) }, realizedExpenses: { total: money(expenseTotal), byCategory: [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, amount]) => ({ category, amount: money(amount) })) }, cashResult: money(cash), grossProfit: money(revenue.sub(costs)), operatingProfit: money(revenue.sub(costs).sub(expenseTotal)), partsGrossMargin: { sales: money(parts), cost: traceable ? money(costs) : null, margin: traceable ? money(parts.sub(costs)) : null, traceable }, accountsReceivable: receivable, accountsPayable: payable, monthlyComparison: months };
  }

  private months(from: Date, to: Date, payments: Array<{ amount: Prisma.Decimal; paidAt: Date | null }>, sales: Array<{ amount: Prisma.Decimal; paidAt: Date | null }>, expenses: Array<{ amount: Prisma.Decimal; paidAt: Date | null }>) {
    const result: Array<{ month: string; revenue: string; expenses: string; cashResult: string }> = []; const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (cursor < to) { const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)); const inMonth = (p: { paidAt: Date | null }) => !!p.paidAt && p.paidAt >= from && p.paidAt < to && p.paidAt >= cursor && p.paidAt < next; const revenue = [...payments, ...sales].filter(inMonth).reduce((s, p) => add(s, cents(p.amount)), zero()); const out = expenses.filter(inMonth).reduce((s, p) => add(s, cents(p.amount)), zero()); result.push({ month: cursor.toISOString().slice(0, 7), revenue: money(revenue), expenses: money(out), cashResult: money(revenue.sub(out)) }); cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
    return result;
  }

  async csv(principal: AuthenticatedPrincipal, query: ManagerialReportQueryDto) { const report = await this.managerial(principal, query); const rows = [['tipo', 'origem', 'valor', 'categoria'], ...report.realizedExpenses.byCategory.map((x) => ['DESPESA', 'ExpensePayment', x.amount, x.category]), ['RECEITA', 'WorkOrder', report.revenue.workOrders, ''], ['RECEITA', 'DirectSale', report.revenue.directSales, '']]; return rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n') + '\n'; }
}

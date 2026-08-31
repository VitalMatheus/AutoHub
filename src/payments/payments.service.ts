import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { sumTotals } from '../quotes/decimal';
import { CreatePaymentDto } from './dto/create-payment.dto';

type PaymentRecord = { amount: Prisma.Decimal | string; status: string; [key: string]: unknown };

function cents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function money(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(principal: AuthenticatedPrincipal): string {
    if (principal.role !== 'ADMIN' || !principal.organizationId) throw new ForbiddenException('Organization Admin access required');
    return principal.organizationId;
  }

  private async lockedWorkOrder(tx: Prisma.TransactionClient, organizationId: string, workOrderId: string) {
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status" FROM "WorkOrder"
      WHERE "id" = ${workOrderId}::uuid AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (locked.length === 0) throw new NotFoundException('Work Order not found');
    if (locked[0].status === 'CANCELLED') throw new ConflictException({ code: 'WORK_ORDER_CANCELLED', detail: 'Cancelled Work Orders cannot receive Payments.' });
    return locked[0];
  }

  private async readableWorkOrder(tx: Prisma.TransactionClient, organizationId: string, workOrderId: string) {
    const workOrder = await tx.workOrder.findFirst({ where: { id: workOrderId, organizationId }, select: { id: true } });
    if (!workOrder) throw new NotFoundException('Work Order not found');
  }

  private async financialState(tx: Prisma.TransactionClient, organizationId: string, workOrderId: string) {
    const items = await tx.workOrderItem.findMany({ where: { organizationId, workOrderId }, select: { quantity: true, unitPrice: true } });
    const total = cents(sumTotals(items.map((item) => ({ quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString() }))));
    const payments = await tx.payment.findMany({ where: { organizationId, workOrderId, status: 'CONFIRMED' }, select: { amount: true } });
    const paid = payments.reduce((sum, payment) => sum + cents(payment.amount.toString()), 0n);
    const status = paid === 0n ? 'UNPAID' : paid < total ? 'PARTIAL' : 'PAID';
    return { total, paid, balance: total - paid, status };
  }

  private format(payment: PaymentRecord, state: { total: bigint; paid: bigint; balance: bigint; status: string }) {
    return {
      ...payment,
      amount: money(cents(payment.amount.toString())),
      paidAt: payment.paidAt instanceof Date ? payment.paidAt.toISOString() : payment.paidAt,
      financial: { total: money(state.total), paid: money(state.paid), balance: money(state.balance), status: state.status },
    };
  }

  async create(principal: AuthenticatedPrincipal, workOrderId: string, dto: CreatePaymentDto) {
    const organizationId = this.tenant(principal);
    const payment = await this.prisma.$transaction(async (tx) => {
      await this.lockedWorkOrder(tx, organizationId, workOrderId);
      const state = await this.financialState(tx, organizationId, workOrderId);
      const status = dto.status ?? 'CONFIRMED';
      const requested = cents(dto.amount);
      if (status === 'CONFIRMED' && requested > state.balance) throw new ConflictException({ code: 'PAYMENT_EXCEEDS_BALANCE', detail: 'Payment exceeds the Work Order balance.' });
      const created = await tx.payment.create({
        data: { organizationId, workOrderId, amount: dto.amount, method: dto.method, status, paidAt: new Date(dto.paidAt) },
      });
      return { payment: created, state: await this.financialState(tx, organizationId, workOrderId) };
    });
    return this.format(payment.payment, payment.state);
  }

  async list(principal: AuthenticatedPrincipal, workOrderId: string) {
    const organizationId = this.tenant(principal);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.readableWorkOrder(tx, organizationId, workOrderId);
      const [payments, state] = await Promise.all([
        tx.payment.findMany({ where: { organizationId, workOrderId }, orderBy: { createdAt: 'asc' } }),
        this.financialState(tx, organizationId, workOrderId),
      ]);
      return { payments, state };
    });
    return { data: result.payments.map((payment) => this.format(payment, result.state)), financial: { total: money(result.state.total), paid: money(result.state.paid), balance: money(result.state.balance), status: result.state.status } };
  }

  async cancel(principal: AuthenticatedPrincipal, workOrderId: string, paymentId: string) {
    const organizationId = this.tenant(principal);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockedWorkOrder(tx, organizationId, workOrderId);
      const payment = await tx.payment.findFirst({ where: { id: paymentId, workOrderId, organizationId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === 'CANCELLED') throw new ConflictException({ code: 'PAYMENT_ALREADY_CANCELLED', detail: 'Payment is already cancelled.' });
      const updateResult = await tx.payment.updateMany({ where: { id: paymentId, organizationId, workOrderId }, data: { status: 'CANCELLED' } });
      if (updateResult.count !== 1) throw new NotFoundException('Payment not found');
      const updated = await tx.payment.findFirstOrThrow({ where: { id: paymentId, organizationId, workOrderId } });
      return { payment: updated, state: await this.financialState(tx, organizationId, workOrderId) };
    });
    return this.format(result.payment, result.state);
  }
}

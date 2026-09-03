import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionChargeNature, ChargeSettlementKind } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';
import { addAnchoredCivilMonths, addCivilDays, addCivilMonths, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';
import { chargeBalance } from '../billing/commercial-access';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ListChargesDto, ChargeConditionDto } from './dto/list-charges.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { CreateSettlementDto, ReverseSettlementDto } from './dto/settlement.dto';
import { AdministrativeSettlementDto } from './dto/administrative-settlement.dto';

const select = { id:true, commercialAccountId:true, subscriptionId:true, organizationId:true, amount:true, dueDate:true, nature:true, billingPeriodStart:true, billingPeriodEnd:true, provider:true, externalId:true, cancelledAt:true, createdAt:true, updatedAt:true,
  commercialAccount:{select:{id:true,name:true}}, subscription:{select:{id:true}}, organization:{select:{id:true,name:true}}, settlements:{orderBy:{createdAt:'asc' as const},select:{id:true,originalSettlementId:true,kind:true,origin:true,method:true,amount:true,receivedAt:true,effectiveAt:true,reason:true,provider:true,externalId:true,createdAt:true}} } as const;
type Row = Prisma.SubscriptionChargeGetPayload<{select:typeof select}>;

export function deriveChargeCondition(charge: { amount: Prisma.Decimal; dueDate: Date; cancelledAt: Date|null; settlements: {amount: Prisma.Decimal}[] }, asOf = new Date()) {
  const paidAmount = charge.settlements.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  const outstandingAmount = charge.cancelledAt ? new Prisma.Decimal(0) : charge.amount.sub(paidAmount);
  const condition = charge.cancelledAt ? ChargeConditionDto.CANCELLED : outstandingAmount.isZero() ? ChargeConditionDto.PAID : recifeCivilDate(asOf) > charge.dueDate.toISOString().slice(0, 10) ? ChargeConditionDto.OVERDUE : paidAmount.gt(0) ? ChargeConditionDto.PARTIALLY_PAID : ChargeConditionDto.PENDING;
  return { condition, paidAmount: paidAmount.toFixed(2), outstandingAmount: outstandingAmount.toFixed(2) };
}
function present(row: Row, asOf = new Date()) { const derived = deriveChargeCondition(row, asOf); return {...row, amount:row.amount.toFixed(2), settlements:row.settlements.map(s=>({...s,amount:s.amount.toFixed(2)})), ...derived}; }

@Injectable()
export class SubscriptionChargesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditEventsService) {}

  async accountCharge(principal: AuthenticatedPrincipal) {
    if (principal.role !== 'ADMIN' || !principal.organizationId) throw new NotFoundException('Subscription Charge not found');
    const organization = await this.prisma.organization.findUnique({ where: { id: principal.organizationId }, select: { id: true, commercialAccountId: true } });
    if (!organization?.commercialAccountId) throw new NotFoundException('Subscription Charge not found');
    const rows = await this.prisma.subscriptionCharge.findMany({
      where: {
        commercialAccountId: organization.commercialAccountId, cancelledAt: null,
        nature: { in: [SubscriptionChargeNature.FIRST_PAYMENT, SubscriptionChargeNature.RENEWAL] },
        subscription: { status: { in: ['CURRENT', 'ENDED'] } },
        OR: [{ organizationId: organization.id }, { organizationId: null }],
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], select,
    });
    const row = rows.find((charge) => chargeBalance(charge).gt(0));
    if (!row) throw new NotFoundException('Subscription Charge not found');
    const presented = present(row);
    return {
      id: presented.id, subscriptionId: presented.subscriptionId, organizationId: organization.id,
      amount: presented.amount, dueDate: presented.dueDate.toISOString().slice(0, 10), nature: presented.nature,
      billingPeriodStart: presented.billingPeriodStart?.toISOString().slice(0, 10) ?? null,
      billingPeriodEnd: presented.billingPeriodEnd?.toISOString().slice(0, 10) ?? null,
      condition: presented.condition, paidAmount: presented.paidAmount, outstandingAmount: presented.outstandingAmount,
    };
  }

  /** MVP daily reconciliation for the simple monthly contract. */
  async reconcileSimpleMonthlyCharges(asOf = new Date()) {
    const today = recifeCivilDate(asOf);
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'CURRENT', trialEnabled: false, firstDueDate: { not: null }, billingDay: { not: null }, commercialAccountId: { not: null },
        OR: [{ effectiveCancellationAt: null }, { effectiveCancellationAt: { gt: asOf } }],
      },
      select: { id: true, commercialAccountId: true, contractedPrice: true, firstDueDate: true, billingDay: true, effectiveCancellationAt: true },
    });
    const chargeIds: string[] = [];

    for (const subscription of subscriptions) {
      if (subscription.effectiveCancellationAt && subscription.effectiveCancellationAt <= asOf) continue;
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${subscription.id}, 0))`;
          const current = await tx.subscription.findUnique({ where: { id: subscription.id }, select: {
            id: true, commercialAccountId: true, status: true, trialEnabled: true, contractedPrice: true,
            firstDueDate: true, billingDay: true, effectiveCancellationAt: true,
          } });
          if (!current || current.status !== 'CURRENT' || current.trialEnabled || !current.commercialAccountId || !current.firstDueDate || current.billingDay === null) return;
          if (current.effectiveCancellationAt && current.effectiveCancellationAt <= asOf) return;

          const charges = await tx.subscriptionCharge.findMany({ where: { subscriptionId: current.id, cancelledAt: null, nature: { in: [SubscriptionChargeNature.FIRST_PAYMENT, SubscriptionChargeNature.RENEWAL] } }, orderBy: { dueDate: 'desc' }, select: {
            amount: true, dueDate: true, nature: true, billingPeriodStart: true, billingPeriodEnd: true, cancelledAt: true,
            settlements: { select: { amount: true } },
          } });
          const open = charges.find((charge) => chargeBalance(charge).gt(0));
          if (open) return;

          const previous = charges[0];
          const dueDate = previous ? addAnchoredCivilMonths(previous.dueDate.toISOString().slice(0, 10), 1) : current.firstDueDate.toISOString().slice(0, 10);
          if (today < addCivilDays(dueDate, -5)) return;
          const periodEnd = addAnchoredCivilMonths(dueDate, 1);
          const nature = previous ? SubscriptionChargeNature.RENEWAL : SubscriptionChargeNature.FIRST_PAYMENT;
          const charge = await tx.subscriptionCharge.create({ data: {
            commercialAccountId: current.commercialAccountId, subscriptionId: current.id, amount: current.contractedPrice,
            dueDate: recifeMidnight(dueDate), nature, billingPeriodStart: recifeMidnight(dueDate), billingPeriodEnd: recifeMidnight(periodEnd),
          }, select: { id: true } });
          await this.audit.record(tx, null, {
            action: AuditAction.SUBSCRIPTION_CHARGE_CREATED, targetType: AuditTargetType.SUBSCRIPTION_CHARGE, targetId: charge.id,
            commercialAccountId: current.commercialAccountId, after: { nature, dueDate, billingPeriodStart: dueDate, billingPeriodEnd: periodEnd, system: true },
          });
          chargeIds.push(charge.id);
        });
      } catch (error) {
        const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
          ? (error.meta as { target?: unknown } | undefined)?.target : undefined;
        const periodConflict = Array.isArray(target) && ['subscriptionId', 'nature', 'billingPeriodStart', 'billingPeriodEnd'].every((field) => target.includes(field));
        if (!periodConflict) throw error;
      }
    }

    return { created: chargeIds.length, chargeIds };
  }

  /** Daily command seam. It is deliberately never called from module startup. */
  async reconcileFirstPayments(asOf = new Date()) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: { not: 'ENDED' }, trialEnabled: true, trialStartsAt: { not: null }, trialEndsAt: { not: null }, firstPaymentReceivedAt: null,
        firstDueDate: { not: null }, billingDay: { not: null },
        OR: [{ effectiveCancellationAt: null }, { effectiveCancellationAt: { gt: asOf } }] },
      select: { id: true, commercialAccountId: true, contractedPrice: true, trialStartsAt: true },
    });
    const issueDate = recifeCivilDate(asOf);
    const created: string[] = [];
    for (const subscription of subscriptions) {
      const trialStart = recifeCivilDate(subscription.trialStartsAt!);
      if (issueDate < addCivilDays(trialStart, 9)) continue;
      const dueDate = addCivilDays(trialStart, 13);
      try {
        await this.prisma.$transaction(async (tx) => {
          const charge = await tx.subscriptionCharge.create({ data: {
            commercialAccountId: subscription.commercialAccountId!, subscriptionId: subscription.id,
            amount: subscription.contractedPrice, dueDate: recifeMidnight(dueDate), nature: 'FIRST_PAYMENT',
          }, select: { id: true } });
          await this.audit.record(tx, null, { action: AuditAction.SUBSCRIPTION_CHARGE_CREATED, targetType: AuditTargetType.SUBSCRIPTION_CHARGE, targetId: charge.id, commercialAccountId: subscription.commercialAccountId!, after: { nature: 'FIRST_PAYMENT', dueDate, system: true } });
          created.push(charge.id);
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
    }
    return { created: created.length, chargeIds: created };
  }

  /** Internal daily command seam. Safe to invoke repeatedly and concurrently. */
  async reconcile(asOf = new Date()) {
    const first = await this.reconcileFirstPayments(asOf);
    const today = recifeCivilDate(asOf);
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'CURRENT', trialEnabled: true, firstPaymentReceivedAt: { not: null }, firstPaidPeriodStartedAt: { not: null },
        firstDueDate: { not: null }, billingDay: { not: null },
        commercialAccountId: { not: null },
      },
      select: {
        id: true, commercialAccountId: true, contractedPrice: true, firstPaidPeriodStartedAt: true,
        effectiveCancellationAt: true,
      },
    });
    const chargeIds: string[] = [];

    for (const subscription of subscriptions) {
      const anchor = recifeCivilDate(subscription.firstPaidPeriodStartedAt!);
      const cancellationDate = subscription.effectiveCancellationAt ? recifeCivilDate(subscription.effectiveCancellationAt) : null;
      if (cancellationDate && cancellationDate <= today) {
        await this.prisma.$transaction(async (tx) => {
          const before = await tx.subscription.findUnique({ where: { id: subscription.id }, select: { status: true, effectiveCancellationAt: true, commercialAccountId: true } });
          if (!before || before.status === 'ENDED') return;
          const ended = await tx.subscription.update({ where: { id: subscription.id }, data: { status: 'ENDED' }, select: { status: true } });
          await this.audit.record(tx, null, { action: AuditAction.SUBSCRIPTION_CANCELLED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscription.id, commercialAccountId: before.commercialAccountId!, reason: 'Effective Cancellation', before, after: ended });
        });
        continue;
      }
      let offset = 0;
      while (true) {
        const periodStart = addAnchoredCivilMonths(anchor, offset);
        const periodEnd = addAnchoredCivilMonths(anchor, offset + 1);
        if (periodStart > today || (cancellationDate && periodStart >= cancellationDate)) break;
        // The first paid period is covered by FIRST_PAYMENT and must not be
        // represented a second time as a renewal.
        if (offset > 0) {
          try {
            await this.prisma.$transaction(async (tx) => {
              const effective = await this.applyScheduledChanges(tx, subscription.id, recifeMidnight(periodStart));
              const charge = await tx.subscriptionCharge.create({
                data: {
                  commercialAccountId: subscription.commercialAccountId!, subscriptionId: subscription.id,
                  amount: effective.contractedPrice ?? subscription.contractedPrice, dueDate: recifeMidnight(periodStart), nature: 'RENEWAL',
                  billingPeriodStart: recifeMidnight(periodStart), billingPeriodEnd: recifeMidnight(periodEnd),
                }, select: { id: true },
              });
              await this.audit.record(tx, null, {
                action: AuditAction.SUBSCRIPTION_CHARGE_CREATED, targetType: AuditTargetType.SUBSCRIPTION_CHARGE,
                targetId: charge.id, commercialAccountId: subscription.commercialAccountId!,
                after: { nature: 'RENEWAL', billingPeriodStart: periodStart, billingPeriodEnd: periodEnd, system: true },
              });
              chargeIds.push(charge.id);
            });
          } catch (error) {
            // The unique period constraint is the concurrency gate. A loser
            // of the race has already achieved the desired state.
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
          }
        }
        offset += 1;
      }
    }
    const simple = await this.reconcileSimpleMonthlyCharges(asOf);
    return { created: first.created + chargeIds.length + simple.created, chargeIds: [...first.chargeIds, ...chargeIds, ...simple.chargeIds] };
  }

  /** Applies future commercial changes at a renewal, atomically with its Charge. */
  private async applyScheduledChanges(tx: any, subscriptionId: string, periodStart: Date) {
    // Lightweight unit doubles may not expose the new scheduling relation.
    if (!tx.subscription?.findUnique) return { contractedPrice: undefined };
    const current = await tx.subscription.findUnique({ where: { id: subscriptionId }, select: {
      id: true, commercialAccountId: true, contractedPrice: true, contractedCurrency: true, contractedInterval: true,
      contractedOrganizationLimit: true, contractedUserLimit: true, contractedWorkOrderLimit: true, contractedGracePeriodDays: true,
      planVersionId: true, scheduledPlanVersionId: true, scheduledPlanEffectiveAt: true, scheduledPlanReason: true,
      scheduledRecurringAdjustment: true, scheduledAdjustmentEffectiveAt: true, scheduledAdjustmentReason: true,
    } });
    if (!current) return { contractedPrice: undefined };
    let price = current.contractedPrice as Prisma.Decimal;
    const planDue = current.scheduledPlanVersionId && current.scheduledPlanEffectiveAt && current.scheduledPlanEffectiveAt <= periodStart;
    const adjustmentDue = current.scheduledRecurringAdjustment !== null && current.scheduledAdjustmentEffectiveAt && current.scheduledAdjustmentEffectiveAt <= periodStart;
    let plan = null;
    if (planDue) {
      plan = await tx.planVersion.findUnique({ where: { id: current.scheduledPlanVersionId }, select: { id: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, workOrderLimit: true, gracePeriodDays: true } });
      if (!plan) throw new ConflictException('Scheduled Plan Version no longer exists');
      const organizations = await tx.organization.count({ where: { commercialAccountId: current.commercialAccountId, operationalStatus: { not: 'INACTIVE' } } });
      const users = await tx.user.count({ where: { organization: { commercialAccountId: current.commercialAccountId }, status: { not: 'DISABLED' } } });
      const workOrders = plan.workOrderLimit === null ? 0 : await tx.workOrder.count({ where: { organization: { commercialAccountId: current.commercialAccountId } } });
      // A downgrade remains pending until usage complies. Existing data is never removed.
      if (organizations > plan.organizationLimit || users > plan.userLimit || (plan.workOrderLimit !== null && workOrders > plan.workOrderLimit)) plan = null;
    }
    const data: Record<string, unknown> = {};
    if (plan) {
      price = plan.price;
      data.planVersionId = plan.id; data.contractedPrice = plan.price; data.contractedCurrency = plan.currency;
      data.contractedInterval = plan.interval; data.contractedOrganizationLimit = plan.organizationLimit; data.contractedUserLimit = plan.userLimit;
      data.contractedWorkOrderLimit = plan.workOrderLimit; data.contractedGracePeriodDays = plan.gracePeriodDays;
      data.scheduledPlanVersionId = null; data.scheduledPlanEffectiveAt = null; data.scheduledPlanReason = null;
    }
    if (adjustmentDue) {
      const next = price.add(current.scheduledRecurringAdjustment);
      if (next.lt(0)) throw new ConflictException('Contracted Price cannot become negative');
      price = next; data.contractedPrice = next; data.scheduledRecurringAdjustment = null; data.scheduledAdjustmentEffectiveAt = null; data.scheduledAdjustmentReason = null;
    }
    if (Object.keys(data).length) {
      const updated = await tx.subscription.update({ where: { id: subscriptionId }, data, select: { contractedPrice: true, planVersionId: true } });
      if (plan) await this.audit.record(tx, null, { action: AuditAction.SUBSCRIPTION_PLAN_CHANGE_APPLIED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscriptionId, commercialAccountId: current.commercialAccountId, before: { planVersionId: current.planVersionId, contractedPrice: current.contractedPrice.toFixed(2) }, after: { planVersionId: updated.planVersionId, contractedPrice: updated.contractedPrice.toFixed(2), effectiveAt: periodStart, system: true } });
      if (adjustmentDue) await this.audit.record(tx, null, { action: AuditAction.SUBSCRIPTION_RECURRING_ADJUSTMENT_APPLIED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscriptionId, commercialAccountId: current.commercialAccountId, before: { contractedPrice: current.contractedPrice.toFixed(2) }, after: { contractedPrice: updated.contractedPrice.toFixed(2), effectiveAt: periodStart, system: true } });
    }
    return { contractedPrice: price };
  }

  async list(dto: ListChargesDto) {
    const where: Prisma.SubscriptionChargeWhereInput = { ...(dto.commercialAccountId?{commercialAccountId:dto.commercialAccountId}:{}), ...(dto.subscriptionId?{subscriptionId:dto.subscriptionId}:{}), ...(dto.organizationId?{organizationId:dto.organizationId}:{}), ...(dto.nature?{nature:dto.nature as SubscriptionChargeNature}:{}), ...(dto.dueFrom||dto.dueTo?{dueDate:{...(dto.dueFrom?{gte:new Date(dto.dueFrom)}:{}),...(dto.dueTo?{lte:new Date(dto.dueTo)}:{})}}:{}) };
    const [rows,total] = await this.prisma.$transaction([this.prisma.subscriptionCharge.findMany({where,select,orderBy:[{dueDate:'asc'},{id:'asc'}],...(dto.condition ? {} : {skip:(dto.page-1)*dto.pageSize,take:dto.pageSize})}),this.prisma.subscriptionCharge.count({where})]);
    const filtered = rows.map((row) => present(row)).filter(row => !dto.condition || row.condition === dto.condition);
    const conditionTotal = dto.condition ? filtered.length : total;
    return {data:dto.condition ? filtered.slice((dto.page-1)*dto.pageSize,dto.page*dto.pageSize) : filtered,meta:{page:dto.page,pageSize:dto.pageSize,total:conditionTotal,totalPages:Math.ceil(conditionTotal/dto.pageSize)}};
  }
  async detail(id:string) { const row=await this.prisma.subscriptionCharge.findUnique({where:{id},select}); if(!row) throw new NotFoundException('Subscription Charge not found'); return present(row); }

  async create(principal:AuthenticatedPrincipal,dto:CreateChargeDto) {
    if ((dto.provider && !dto.externalId) || (!dto.provider && dto.externalId)) throw new BadRequestException('provider and externalId must be supplied together');
    return this.prisma.$transaction(async tx => {
      const [account, subscription] = await Promise.all([tx.commercialAccount.findUnique({where:{id:dto.commercialAccountId},select:{id:true}}),tx.subscription.findUnique({where:{id:dto.subscriptionId},select:{id:true,commercialAccountId:true}})]);
      if(!account || !subscription || subscription.commercialAccountId !== account.id) throw new NotFoundException('Commercial subscription not found');
      if(dto.organizationId && !(await tx.organization.findFirst({where:{id:dto.organizationId,commercialAccountId:account.id},select:{id:true}}))) throw new NotFoundException('Organization not found');
      try { const row=await tx.subscriptionCharge.create({data:{commercialAccountId:account.id,subscriptionId:subscription.id,organizationId:dto.organizationId,amount:new Prisma.Decimal(dto.amount),dueDate:new Date(dto.dueDate),nature:dto.nature as SubscriptionChargeNature,billingPeriodStart:dto.billingPeriodStart?new Date(dto.billingPeriodStart):null,billingPeriodEnd:dto.billingPeriodEnd?new Date(dto.billingPeriodEnd):null,provider:dto.provider,externalId:dto.externalId},select}); await this.audit.record(tx,principal,{action:AuditAction.SUBSCRIPTION_CHARGE_CREATED,targetType:AuditTargetType.SUBSCRIPTION_CHARGE,targetId:row.id,commercialAccountId:account.id,after:present(row)}); return present(row); } catch(e) { if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2002' && dto.provider && dto.externalId){ const existing=await tx.subscriptionCharge.findFirst({where:{provider:dto.provider,externalId:dto.externalId},select}); if(existing)return present(existing); } if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2002') throw new ConflictException('Charge external identifier or billing period already exists'); throw e; }
    });
  }
  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateChargeDto) {
    if (dto.amount === undefined && dto.dueDate === undefined) throw new BadRequestException('amount or dueDate is required');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.subscriptionCharge.findUnique({ where: { id }, select });
      if (!before) throw new NotFoundException('Subscription Charge not found');
      if (before.settlements.length > 0 && dto.amount !== undefined) throw new ConflictException('Settled Charge amount is immutable');
      if (before.settlements.length > 0 && dto.dueDate && new Date(dto.dueDate) < before.dueDate) throw new ConflictException('Settled Charge due date can only be postponed');
      const row = await tx.subscriptionCharge.update({ where: { id }, data: {
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
      }, select });
      await this.audit.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CHARGE_UPDATED, targetType: AuditTargetType.SUBSCRIPTION_CHARGE, targetId: id, commercialAccountId: row.commercialAccountId, reason: dto.reason.trim(), before: present(before), after: present(row) });
      return present(row);
    });
  }
  async cancel(principal:AuthenticatedPrincipal,id:string) { return this.prisma.$transaction(async tx=>{const before=await tx.subscriptionCharge.findUnique({where:{id},select});if(!before)throw new NotFoundException('Subscription Charge not found');if(before.cancelledAt) return present(before);if(deriveChargeCondition(before).paidAmount!=='0.00')throw new ConflictException('Charge with settled amount cannot be cancelled');const row=await tx.subscriptionCharge.update({where:{id},data:{cancelledAt:new Date()},select});await this.audit.record(tx,principal,{action:AuditAction.SUBSCRIPTION_CHARGE_CANCELLED,targetType:AuditTargetType.SUBSCRIPTION_CHARGE,targetId:id,commercialAccountId:row.commercialAccountId,before:present(before),after:present(row)});return present(row);}); }
  private async lock(tx: Prisma.TransactionClient, id: string) {
    // Updating the row first serializes concurrent settlements under PostgreSQL's
    // default READ COMMITTED isolation without escaping the Prisma transaction.
    await tx.subscriptionCharge.update({ where: { id }, data: { updatedAt: new Date() }, select: { id: true } });
  }
  async settle(principal: AuthenticatedPrincipal, id: string, dto: CreateSettlementDto) {
    const receivedAt = new Date(dto.receivedAt); const now = new Date();
    if (receivedAt > now) throw new BadRequestException('receivedAt cannot be in the future');
    if (now.getTime() - receivedAt.getTime() > 7 * 86400000 && !dto.reason?.trim()) throw new BadRequestException('Backdated settlements beyond seven days require a reason');
    if ((dto.provider && !dto.externalId) || (!dto.provider && dto.externalId)) throw new BadRequestException('provider and externalId must be supplied together');
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const charge = await tx.subscriptionCharge.findUnique({ where: { id }, select });
      if (!charge) throw new NotFoundException('Subscription Charge not found');
      if (dto.provider && dto.externalId) {
        const existing = await tx.chargeSettlement.findFirst({ where: { provider: dto.provider, externalId: dto.externalId }, select: { id: true, chargeId: true } });
        if (existing) {
          if (existing.chargeId !== id) throw new ConflictException('Settlement external identifier already belongs to another Charge');
          return present(charge);
        }
      }
      if (charge.cancelledAt) throw new ConflictException('Cancelled Charge cannot receive settlements');
      const open = new Prisma.Decimal(deriveChargeCondition(charge).outstandingAmount); const amount = new Prisma.Decimal(dto.amount);
      if (amount.lte(0) || amount.gt(open)) throw new ConflictException('Settlement exceeds open Charge balance');
      try {
        const settlement = await tx.chargeSettlement.create({ data: { chargeId: id, kind: ChargeSettlementKind.RECEIPT, origin: 'GATEWAY', amount, receivedAt, reason: dto.reason?.trim(), provider: dto.provider, externalId: dto.externalId }, select: { id: true } });
        const row = await tx.subscriptionCharge.findUniqueOrThrow({ where: { id }, select });
        if (row.nature === SubscriptionChargeNature.FIRST_PAYMENT && deriveChargeCondition(row).condition === ChargeConditionDto.PAID) {
          const paidDate = recifeCivilDate(receivedAt);
          const trialEndDate = row.subscription?.id ? (await tx.subscription.findUnique({ where: { id: row.subscription.id }, select: { trialEndsAt: true, trialEnabled: true } })) : null;
          const paidStartDate = trialEndDate?.trialEnabled && trialEndDate.trialEndsAt && receivedAt < trialEndDate.trialEndsAt
            ? recifeCivilDate(trialEndDate.trialEndsAt) : paidDate;
          await tx.subscription.update({ where: { id: row.subscription.id }, data: {
            status: 'CURRENT', firstPaymentReceivedAt: receivedAt, firstPaidPeriodStartedAt: recifeMidnight(paidStartDate),
            currentPeriodStart: recifeMidnight(paidStartDate), currentPeriodEnd: recifeMidnight(addCivilMonths(paidStartDate, 1)),
          } });
        }
        await this.audit.record(tx, principal, { action: AuditAction.CHARGE_SETTLEMENT_CREATED, targetType: AuditTargetType.CHARGE_SETTLEMENT, targetId: settlement.id, commercialAccountId: row.commercialAccountId, reason: dto.reason?.trim(), after: { amount: dto.amount, receivedAt: dto.receivedAt } });
        return present(row);
      } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Settlement external identifier already exists'); throw e; }
    });
  }
  async administrativelySettle(principal: AuthenticatedPrincipal, id: string, dto: AdministrativeSettlementDto) {
    if (principal.role !== 'SUPER_ADMIN') throw new ConflictException('Only a Super Admin can register an administrative settlement');
    const effectiveAt = new Date(dto.effectiveAt);
    if (effectiveAt > new Date()) throw new BadRequestException('effectiveAt cannot be in the future');
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Administrative settlement reason is required');
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Administrative settlement amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const charge = await tx.subscriptionCharge.findUnique({ where: { id }, select });
      if (!charge) throw new NotFoundException('Subscription Charge not found');
      if (charge.cancelledAt) throw new ConflictException('Cancelled Charge cannot be settled');
      if (charge.nature !== SubscriptionChargeNature.FIRST_PAYMENT && charge.nature !== SubscriptionChargeNature.RENEWAL) {
        throw new ConflictException('Only monthly Subscription Charges can receive an administrative settlement');
      }
      const outstanding = chargeBalance(charge);
      if (outstanding.lte(0)) throw new ConflictException('Subscription Charge is already fully settled');
      if (!amount.eq(outstanding)) throw new ConflictException('Administrative settlement must equal the full open Charge balance');

      const settlement = await tx.chargeSettlement.create({ data: {
        chargeId: id, kind: ChargeSettlementKind.RECEIPT, origin: 'ADMINISTRATIVE', method: dto.method,
        amount, receivedAt: effectiveAt, effectiveAt, reason,
      }, select: { id: true } });
      const row = await tx.subscriptionCharge.findUniqueOrThrow({ where: { id }, select });
      if (row.nature === SubscriptionChargeNature.FIRST_PAYMENT && row.subscription?.id) {
        const paidStartDate = recifeCivilDate(effectiveAt);
        await tx.subscription.update({ where: { id: row.subscription.id }, data: {
          status: 'CURRENT', firstPaymentReceivedAt: effectiveAt, firstPaidPeriodStartedAt: recifeMidnight(paidStartDate),
          currentPeriodStart: recifeMidnight(paidStartDate), currentPeriodEnd: recifeMidnight(addCivilMonths(paidStartDate, 1)),
        } });
      }
      await this.audit.record(tx, principal, {
        action: AuditAction.CHARGE_ADMINISTRATIVELY_SETTLED, targetType: AuditTargetType.CHARGE_SETTLEMENT,
        targetId: settlement.id, commercialAccountId: row.commercialAccountId, reason,
        after: { amount: amount.toFixed(2), receivedAt: effectiveAt, effectiveAt, origin: 'ADMINISTRATIVE', method: dto.method },
      });
      return present(row);
    });
  }
  async reverse(principal:AuthenticatedPrincipal,id:string,settlementId:string,dto:ReverseSettlementDto) {return this.prisma.$transaction(async tx=>{await this.lock(tx,id);const original=await tx.chargeSettlement.findFirst({where:{id:settlementId,chargeId:id,kind:ChargeSettlementKind.RECEIPT}});if(!original)throw new NotFoundException('Settlement not found');const reversed=await tx.chargeSettlement.aggregate({where:{originalSettlementId:settlementId,kind:ChargeSettlementKind.REVERSAL},_sum:{amount:true}});const total=new Prisma.Decimal(reversed._sum.amount??0).abs();if(total.gte(original.amount))throw new ConflictException('Settlement is already fully reversed');const amount=original.amount.sub(total).neg();const row=await tx.chargeSettlement.create({data:{chargeId:id,originalSettlementId:settlementId,kind:ChargeSettlementKind.REVERSAL,origin:original.origin,method:original.method,amount,receivedAt:new Date(),effectiveAt:dto.effectiveAt?new Date(dto.effectiveAt):new Date(),reason:dto.reason.trim(),provider:dto.provider,externalId:dto.externalId},select:{id:true}});const charge=await tx.subscriptionCharge.findUniqueOrThrow({where:{id},select});await this.audit.record(tx,principal,{action:AuditAction.CHARGE_SETTLEMENT_REVERSED,targetType:AuditTargetType.CHARGE_SETTLEMENT,targetId:row.id,commercialAccountId:charge.commercialAccountId,reason:dto.reason.trim(),after:{amount:amount.toFixed(2),originalSettlementId:settlementId}});return present(charge);});}
}

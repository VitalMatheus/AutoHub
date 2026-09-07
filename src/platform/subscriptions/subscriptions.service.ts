import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import { RegularizeSubscriptionDto } from './dto/regularize-subscription.dto';
import { SchedulePlanChangeDto } from './dto/schedule-plan-change.dto';
import { ScheduleRecurringAdjustmentDto } from './dto/schedule-recurring-adjustment.dto';
import { addAnchoredCivilMonths, addCivilDays, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';
import { deriveCommercialAccess, AccessCharge } from '../billing/commercial-access';

const subscriptionSelect = {
  id: true, commercialAccountId: true, planVersionId: true, status: true, contractedPrice: true, contractedCurrency: true,
  contractedInterval: true, contractedOrganizationLimit: true, contractedUserLimit: true, contractedWorkOrderLimit: true,
  contractedGracePeriodDays: true, migratedAt: true, regularizedAt: true, regularizationReason: true, commercialStartAt: true,
  firstDueDate: true, billingDay: true,
  firstPaymentReceivedAt: true, firstPaidPeriodStartedAt: true, trialEnabled: true, trialStartsAt: true, trialEndsAt: true, currentPeriodStart: true,
  currentPeriodEnd: true, cancellationRequestedAt: true, effectiveCancellationAt: true, dataRetentionEndsAt: true, dataFinalizedAt: true, createdAt: true,
  scheduledPlanVersionId: true, scheduledPlanEffectiveAt: true, scheduledPlanReason: true,
  scheduledRecurringAdjustment: true, scheduledAdjustmentEffectiveAt: true, scheduledAdjustmentReason: true,
  planVersion: { select: { id: true, version: true, plan: { select: { id: true, name: true } } } },
  commercialAccount: { select: { id: true, name: true } },
  charges: { select: { nature: true, dueDate: true, amount: true, cancelledAt: true, settlements: { select: { amount: true } } } },
} as const;

export function deriveSubscriptionConditions(subscription: {
  status: SubscriptionStatus; migratedAt: Date | null; regularizedAt: Date | null; trialEnabled?: boolean; trialStartsAt: Date | null; trialEndsAt: Date | null;
  firstDueDate?: Date | null; billingDay?: number | null;
  firstPaymentReceivedAt: Date | null; cancellationRequestedAt: Date | null; effectiveCancellationAt: Date | null;
  charges?: AccessCharge[];
}, asOf = new Date()) {
  const cancellationEffective = !!subscription.effectiveCancellationAt && asOf >= subscription.effectiveCancellationAt;
  const trial = subscription.trialEnabled !== false && !!subscription.trialStartsAt && !!subscription.trialEndsAt && asOf >= subscription.trialStartsAt && asOf < subscription.trialEndsAt && !cancellationEffective;
  const pendingCommercialSetup = (subscription.firstDueDate === null || subscription.billingDay === null) && !cancellationEffective;
  const awaitingFirstPayment = !pendingCommercialSetup && !subscription.firstPaymentReceivedAt && !trial && subscription.status !== 'ENDED' && !cancellationEffective;
  const payment = deriveCommercialAccess(subscription.charges ?? [], asOf);
  const commercialAccess = cancellationEffective || subscription.status === 'ENDED' ? 'PAYMENT_BLOCKED' : pendingCommercialSetup || trial
    ? 'ACCESS_ALLOWED'
    : !subscription.firstPaymentReceivedAt
      ? 'PAYMENT_BLOCKED'
      : payment.commercialAccess;
  return {
    pendingCommercialSetup, trial, awaitingFirstPayment, delinquent: payment.delinquent,
    paymentGracePeriod: payment.paymentGracePeriod,
    scheduledCancellation: !!subscription.cancellationRequestedAt && !cancellationEffective && subscription.status !== 'ENDED',
    effectiveCancellation: cancellationEffective || subscription.status === 'ENDED',
    commercialAccess,
  } as const;
}

function present(subscription: Prisma.SubscriptionGetPayload<{ select: typeof subscriptionSelect }>, asOf = new Date()) {
  const { contractedPrice, charges: _charges, ...rest } = subscription;
  return { ...rest, contractedPrice: contractedPrice.toFixed(2), scheduledRecurringAdjustment: rest.scheduledRecurringAdjustment?.toFixed(2) ?? null, conditions: deriveSubscriptionConditions(subscription, asOf) };
}

export function retentionDeadline(effectiveAt: Date): Date {
  return recifeMidnight(addCivilDays(recifeCivilDate(effectiveAt), 90));
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService, private readonly auditEvents: AuditEventsService) {}

  async list(dto: ListSubscriptionsDto) {
    const page = dto.page ?? 1; const pageSize = dto.pageSize ?? 20;
    const where: Prisma.SubscriptionWhereInput = { ...(dto.commercialAccountId ? { commercialAccountId: dto.commercialAccountId } : {}), ...(dto.status ? { status: dto.status } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({ where, select: subscriptionSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.subscription.count({ where }),
    ]);
    return { data: rows.map((row) => present(row)), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async detail(id: string) {
    const row = await this.prisma.subscription.findUnique({ where: { id }, select: subscriptionSelect });
    if (!row) throw new NotFoundException('Subscription not found');
    return present(row);
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateSubscriptionDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [account, version] = await Promise.all([
          tx.commercialAccount.findUnique({ where: { id: dto.commercialAccountId }, select: { id: true } }),
          tx.planVersion.findUnique({ where: { id: dto.planVersionId }, select: { id: true, status: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, workOrderLimit: true, gracePeriodDays: true } }),
        ]);
        if (!account) throw new NotFoundException('Commercial Account not found');
        if (!version) throw new NotFoundException('Plan Version not found');
        if (version.status !== 'PUBLISHED') throw new ConflictException('Only published Plan Versions can be contracted');
        await this.endDueCancellation(tx, account.id, principal);
        const previous = await tx.subscription.findFirst({ where: { commercialAccountId: account.id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true } });
        const hasEndedSubscription = previous?.status === 'ENDED';
        const trialEnabled = dto.trialEnabled ?? !previous;
        if (hasEndedSubscription && trialEnabled && !dto.trialExceptionReason?.trim()) throw new BadRequestException('A new Trial requires an explicit exception reason');
        const startsAt = dto.trialStartsAt ? new Date(dto.trialStartsAt) : null;
        const startDate = startsAt ? recifeCivilDate(startsAt) : null;
        const trialEndsAt = trialEnabled && startDate ? recifeMidnight(addCivilDays(startDate, 14)) : null;
        const subscription = await tx.subscription.create({ data: {
          commercialAccountId: account.id, planVersionId: version.id, contractedPrice: version.price, contractedCurrency: version.currency,
          contractedInterval: version.interval, contractedOrganizationLimit: version.organizationLimit, contractedUserLimit: version.userLimit,
          contractedWorkOrderLimit: version.workOrderLimit, contractedGracePeriodDays: version.gracePeriodDays,
          status: trialEnabled ? 'SCHEDULED' : 'CURRENT', commercialStartAt: startsAt,
          trialStartsAt: trialEnabled ? startsAt : null, trialEndsAt,
        }, select: subscriptionSelect });
        if (!trialEnabled) {
          const charge = await tx.subscriptionCharge.create({ data: { commercialAccountId: account.id, subscriptionId: subscription.id, amount: version.price, dueDate: recifeMidnight(startDate ?? recifeCivilDate(new Date())), nature: 'FIRST_PAYMENT' }, select: { id: true, dueDate: true } });
          await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CHARGE_CREATED, targetType: AuditTargetType.SUBSCRIPTION_CHARGE, targetId: charge.id, commercialAccountId: account.id, after: { nature: 'FIRST_PAYMENT', dueDate: charge.dueDate } });
        }
        await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CREATED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscription.id, commercialAccountId: account.id, reason: dto.trialExceptionReason?.trim(), after: present(subscription) });
        if (hasEndedSubscription && trialEnabled) await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_TRIAL_EXCEPTION_GRANTED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscription.id, commercialAccountId: account.id, reason: dto.trialExceptionReason!.trim(), after: { trialEnabled: true } });
        return present(subscription);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Commercial Account already has an open Subscription');
      throw error;
    }
  }

  private async endDueCancellation(tx: Prisma.TransactionClient, commercialAccountId: string, principal: AuthenticatedPrincipal | null, now = new Date()) {
    const due = await tx.subscription.findMany({ where: { commercialAccountId, status: { not: 'ENDED' }, effectiveCancellationAt: { lte: now } }, select: subscriptionSelect });
    for (const before of due) {
      const updated = await tx.subscription.update({ where: { id: before.id }, data: { status: 'ENDED' }, select: subscriptionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CANCELLED, targetType: AuditTargetType.SUBSCRIPTION, targetId: before.id, commercialAccountId, before: present(before), after: present(updated), reason: 'Effective Cancellation' });
    }
  }

  async requestCancellation(principal: AuthenticatedPrincipal, id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { id }, select: subscriptionSelect });
      if (!before) throw new NotFoundException('Subscription not found');
      if (before.status === 'ENDED' || before.effectiveCancellationAt) throw new ConflictException('Subscription is already cancelled');
      if (before.cancellationRequestedAt) return present(before);
      const effectiveAt = before.currentPeriodEnd
        ?? before.trialEndsAt
        ?? (before.firstPaidPeriodStartedAt
          ? recifeMidnight(addAnchoredCivilMonths(recifeCivilDate(before.firstPaidPeriodStartedAt), 1))
          : null);
      if (!effectiveAt || effectiveAt <= new Date()) throw new ConflictException('Subscription has no future period end for scheduled cancellation');
      const updated = await tx.subscription.update({ where: { id }, data: { cancellationRequestedAt: new Date(), effectiveCancellationAt: effectiveAt, dataRetentionEndsAt: retentionDeadline(effectiveAt), dataFinalizedAt: null }, select: subscriptionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CANCELLATION_REQUESTED, targetType: AuditTargetType.SUBSCRIPTION, targetId: id, commercialAccountId: updated.commercialAccountId ?? undefined, reason: reason.trim(), before: present(before), after: present(updated) });
      return present(updated);
    });
  }

  async undoCancellation(principal: AuthenticatedPrincipal, id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { id }, select: subscriptionSelect });
      if (!before) throw new NotFoundException('Subscription not found');
      if (!before.cancellationRequestedAt || !before.effectiveCancellationAt || before.effectiveCancellationAt <= new Date() || before.status === 'ENDED') throw new ConflictException('Cancellation cannot be undone');
      const updated = await tx.subscription.update({ where: { id }, data: { cancellationRequestedAt: null, effectiveCancellationAt: null, dataRetentionEndsAt: null }, select: subscriptionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CANCELLATION_UNDONE, targetType: AuditTargetType.SUBSCRIPTION, targetId: id, commercialAccountId: updated.commercialAccountId ?? undefined, reason: reason.trim(), before: present(before), after: present(updated) });
      return present(updated);
    });
  }

  async cancelImmediately(principal: AuthenticatedPrincipal, id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { id }, select: subscriptionSelect });
      if (!before) throw new NotFoundException('Subscription not found');
      if (before.status === 'ENDED') return present(before);
      const now = new Date();
      const updated = await tx.subscription.update({ where: { id }, data: { status: 'ENDED', cancellationRequestedAt: before.cancellationRequestedAt ?? now, effectiveCancellationAt: now, dataRetentionEndsAt: retentionDeadline(now), dataFinalizedAt: null }, select: subscriptionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CANCELLED, targetType: AuditTargetType.SUBSCRIPTION, targetId: id, commercialAccountId: updated.commercialAccountId ?? undefined, reason: reason.trim(), before: present(before), after: present(updated) });
      return present(updated);
    });
  }

  async regularize(principal: AuthenticatedPrincipal, id: string, dto: RegularizeSubscriptionDto) {
    const commercialStartAt = new Date(dto.commercialStartAt); const firstPaymentReceivedAt = dto.firstPaymentReceivedAt ? new Date(dto.firstPaymentReceivedAt) : null;
    if (firstPaymentReceivedAt && firstPaymentReceivedAt < commercialStartAt) throw new BadRequestException('First payment cannot precede commercial start');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { id }, select: subscriptionSelect });
      if (!before) throw new NotFoundException('Subscription not found');
      if (!before.migratedAt || before.regularizedAt) throw new ConflictException('Subscription is not pending commercial setup');
      const updated = await tx.subscription.update({ where: { id }, data: {
        regularizedAt: new Date(), regularizationReason: dto.reason.trim(), commercialStartAt, firstPaymentReceivedAt,
        firstPaidPeriodStartedAt: firstPaymentReceivedAt, status: firstPaymentReceivedAt ? 'CURRENT' : 'SCHEDULED',
      }, select: subscriptionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_MIGRATED_REGULARIZED, targetType: AuditTargetType.SUBSCRIPTION, targetId: id, commercialAccountId: updated.commercialAccountId ?? undefined, reason: dto.reason.trim(), before: present(before), after: present(updated) });
      return present(updated);
    });
  }

  private futureDate(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new BadRequestException('Effective date must be in the future');
    return date;
  }

  async schedulePlanChange(principal: AuthenticatedPrincipal, id: string, dto: SchedulePlanChangeDto) {
    const effectiveAt = this.futureDate(dto.effectiveAt);
    const reason = dto.reason.trim();
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { id }, select: subscriptionSelect });
      if (!before) throw new NotFoundException('Subscription not found');
      if (before.status === 'ENDED') throw new ConflictException('Ended Subscription cannot be changed');
      const version = await tx.planVersion.findUnique({ where: { id: dto.planVersionId }, select: { id: true, status: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, workOrderLimit: true, gracePeriodDays: true, plan: { select: { archivedAt: true } } } });
      if (!version) throw new NotFoundException('Plan Version not found');
      if (version.status !== 'PUBLISHED' || version.plan.archivedAt) throw new ConflictException('Only published versions from an active Plan can be scheduled');
      const updated = await tx.subscription.update({ where: { id }, data: { scheduledPlanVersionId: version.id, scheduledPlanEffectiveAt: effectiveAt, scheduledPlanReason: reason }, select: subscriptionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_PLAN_CHANGE_SCHEDULED, targetType: AuditTargetType.SUBSCRIPTION, targetId: id, commercialAccountId: updated.commercialAccountId ?? undefined, reason, before: { scheduledPlanVersionId: before.scheduledPlanVersionId, scheduledPlanEffectiveAt: before.scheduledPlanEffectiveAt }, after: { scheduledPlanVersionId: version.id, scheduledPlanEffectiveAt: effectiveAt } });
      return present(updated);
    });
  }

  async scheduleRecurringAdjustment(principal: AuthenticatedPrincipal, id: string, dto: ScheduleRecurringAdjustmentDto) {
    const effectiveAt = this.futureDate(dto.effectiveAt);
    const amount = new Prisma.Decimal(dto.amount);
    const reason = dto.reason.trim();
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { id }, select: subscriptionSelect });
      if (!before) throw new NotFoundException('Subscription not found');
      if (before.status === 'ENDED') throw new ConflictException('Ended Subscription cannot be changed');
      const next = before.contractedPrice.add(amount);
      if (next.lt(0)) throw new ConflictException('Contracted Price cannot become negative');
      const updated = await tx.subscription.update({ where: { id }, data: { scheduledRecurringAdjustment: amount, scheduledAdjustmentEffectiveAt: effectiveAt, scheduledAdjustmentReason: reason }, select: subscriptionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_RECURRING_ADJUSTMENT_SCHEDULED, targetType: AuditTargetType.SUBSCRIPTION, targetId: id, commercialAccountId: updated.commercialAccountId ?? undefined, reason, before: { scheduledRecurringAdjustment: before.scheduledRecurringAdjustment?.toFixed(2) ?? null, scheduledAdjustmentEffectiveAt: before.scheduledAdjustmentEffectiveAt }, after: { scheduledRecurringAdjustment: amount.toFixed(2), scheduledAdjustmentEffectiveAt: effectiveAt } });
      return present(updated);
    });
  }
}

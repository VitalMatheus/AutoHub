import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import { RegularizeSubscriptionDto } from './dto/regularize-subscription.dto';
import { addCivilDays, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';

const subscriptionSelect = {
  id: true, commercialAccountId: true, planVersionId: true, status: true, contractedPrice: true, contractedCurrency: true,
  contractedInterval: true, contractedOrganizationLimit: true, contractedUserLimit: true, contractedWorkOrderLimit: true,
  contractedGracePeriodDays: true, migratedAt: true, regularizedAt: true, regularizationReason: true, commercialStartAt: true,
  firstPaymentReceivedAt: true, firstPaidPeriodStartedAt: true, trialEnabled: true, trialStartsAt: true, trialEndsAt: true, currentPeriodStart: true,
  currentPeriodEnd: true, cancellationRequestedAt: true, effectiveCancellationAt: true, createdAt: true,
  planVersion: { select: { id: true, version: true, plan: { select: { id: true, name: true } } } },
  commercialAccount: { select: { id: true, name: true } },
} as const;

export function deriveSubscriptionConditions(subscription: {
  status: SubscriptionStatus; migratedAt: Date | null; regularizedAt: Date | null; trialEnabled?: boolean; trialStartsAt: Date | null; trialEndsAt: Date | null;
  firstPaymentReceivedAt: Date | null; cancellationRequestedAt: Date | null; effectiveCancellationAt: Date | null;
}, asOf = new Date()) {
  const trial = subscription.trialEnabled !== false && !!subscription.trialStartsAt && !!subscription.trialEndsAt && asOf >= subscription.trialStartsAt && asOf < subscription.trialEndsAt && !subscription.effectiveCancellationAt;
  const pendingCommercialSetup = !!subscription.migratedAt && !subscription.regularizedAt;
  const awaitingFirstPayment = !pendingCommercialSetup && !subscription.firstPaymentReceivedAt && !trial && subscription.status !== 'ENDED' && !subscription.effectiveCancellationAt;
  return {
    pendingCommercialSetup, trial, awaitingFirstPayment, delinquent: false,
    scheduledCancellation: !!subscription.cancellationRequestedAt && !subscription.effectiveCancellationAt,
    effectiveCancellation: !!subscription.effectiveCancellationAt || subscription.status === 'ENDED',
    commercialAccess: pendingCommercialSetup || trial || (!!subscription.firstPaymentReceivedAt && !subscription.effectiveCancellationAt) ? 'ACCESS_ALLOWED' : 'PAYMENT_BLOCKED',
  } as const;
}

function present(subscription: Prisma.SubscriptionGetPayload<{ select: typeof subscriptionSelect }>, asOf = new Date()) {
  const { contractedPrice, ...rest } = subscription;
  return { ...rest, contractedPrice: contractedPrice.toFixed(2), conditions: deriveSubscriptionConditions(subscription, asOf) };
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
        const trialEnabled = dto.trialEnabled !== false;
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
        await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CREATED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscription.id, commercialAccountId: account.id, after: present(subscription) });
        return present(subscription);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Commercial Account already has an open Subscription');
      throw error;
    }
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
}

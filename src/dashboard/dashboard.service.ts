import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { chargeBalance, deriveCommercialAccess } from '../platform/billing/commercial-access';
import { recifeCivilDate, recifeMidnight } from '../platform/billing/civil-dates';
import { deriveSubscriptionConditions } from '../platform/subscriptions/subscriptions.service';
import { AuditAction, AuditTargetType } from '../platform/audit-events/dto/list-audit-events.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const subscriptionSelect = {
  id: true, commercialAccountId: true, status: true, contractedPrice: true,
  trialEnabled: true, trialStartsAt: true, trialEndsAt: true,
  firstPaymentReceivedAt: true, firstPaidPeriodStartedAt: true,
  cancellationRequestedAt: true, effectiveCancellationAt: true, migratedAt: true, regularizedAt: true, commercialStartAt: true,
  charges: { select: { amount: true, dueDate: true, nature: true, cancelledAt: true, settlements: { select: { amount: true } } } },
} as const;
const organizationSelect = { id: true, operationalStatus: true, commercialAccountId: true } as const;
const settlementSelect = { amount: true, kind: true, receivedAt: true, effectiveAt: true, charge: { select: { cancelledAt: true } } } as const;
type SubscriptionRow = Prisma.SubscriptionGetPayload<{ select: typeof subscriptionSelect }>;

function money(value: Prisma.Decimal) { return value.toFixed(2); }
function inRange(value: Date | null, from: Date, to: Date) { return !!value && value >= from && value < to; }

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(principal: AuthenticatedPrincipal, query: DashboardQueryDto = {}) {
    if (principal.role !== 'SUPER_ADMIN') throw new ForbiddenException('Platform access requires Super Admin');
    const referenceAt = query.asOf ? new Date(query.asOf) : new Date();
    const civil = recifeCivilDate(referenceAt);
    const monthStart = recifeMidnight(`${civil.slice(0, 8)}01`);
    const nextMonth = new Date(`${civil.slice(0, 7)}-15T12:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const monthEnd = recifeMidnight(`${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-01`);
    const monthCutoff = referenceAt < monthEnd ? new Date(referenceAt.getTime() + 1) : monthEnd;
    const today = civil;

    return this.prisma.$transaction(async (tx) => {
      const [organizations, subscriptions, settlements, organizationCreatedEvents, commercialAccountCreatedEvents, deactivationEvents] = await Promise.all([
        tx.organization.findMany({ select: organizationSelect }),
        tx.subscription.findMany({ where: { createdAt: { lte: referenceAt } }, select: { ...subscriptionSelect, charges: { where: { createdAt: { lte: referenceAt } }, select: { amount: true, dueDate: true, nature: true, cancelledAt: true, settlements: { where: { OR: [{ kind: 'RECEIPT', receivedAt: { lte: referenceAt } }, { kind: 'REVERSAL', effectiveAt: { lte: referenceAt } }] }, select: { amount: true } } } } } }),
        tx.chargeSettlement.findMany({ where: { OR: [{ receivedAt: { gte: monthStart, lt: monthCutoff } }, { effectiveAt: { gte: monthStart, lt: monthCutoff } }] }, select: settlementSelect }),
        tx.auditEvent.findMany({ where: { targetType: AuditTargetType.ORGANIZATION, action: AuditAction.ORGANIZATION_CREATED, occurredAt: { gte: monthStart, lt: monthCutoff } }, select: { targetId: true } }),
        tx.auditEvent.findMany({ where: { targetType: AuditTargetType.COMMERCIAL_ACCOUNT, action: AuditAction.COMMERCIAL_ACCOUNT_CREATED, occurredAt: { gte: monthStart, lt: monthCutoff } }, select: { targetId: true } }),
        tx.auditEvent.findMany({ where: { targetType: AuditTargetType.ORGANIZATION, action: AuditAction.ORGANIZATION_DEACTIVATED, occurredAt: { gte: monthStart, lt: monthCutoff } }, select: { targetId: true } }),
      ]);
      const conditions = new Map<string, ReturnType<typeof deriveSubscriptionConditions>>();
      for (const subscription of subscriptions) conditions.set(subscription.id, deriveSubscriptionConditions(subscription, referenceAt));
      const byAccount = new Map<string, SubscriptionRow[]>();
      for (const subscription of subscriptions) if (subscription.commercialAccountId) byAccount.set(subscription.commercialAccountId, [...(byAccount.get(subscription.commercialAccountId) ?? []), subscription]);

      const organizationCounts = { total: organizations.length, active: 0, inactive: 0, suspended: 0, commerciallyBlocked: 0 };
      for (const organization of organizations) {
        if (organization.operationalStatus === 'ACTIVE') organizationCounts.active++;
        if (organization.operationalStatus === 'INACTIVE') organizationCounts.inactive++;
        if (organization.operationalStatus === 'SUSPENDED') organizationCounts.suspended++;
        const accountSubscriptions = organization.commercialAccountId ? byAccount.get(organization.commercialAccountId) ?? [] : [];
        if (accountSubscriptions.some((subscription) => conditions.get(subscription.id)!.commercialAccess === 'PAYMENT_BLOCKED')) organizationCounts.commerciallyBlocked++;
      }

      const subscriptionCounts = { trial: 0, paidCurrent: 0, awaitingFirstPayment: 0, delinquent: 0, effectivelyCancelled: 0, pendingCommercialSetup: 0 };
      for (const subscription of subscriptions) {
        const condition = conditions.get(subscription.id)!;
        if (condition.trial) subscriptionCounts.trial++;
        if (condition.awaitingFirstPayment) subscriptionCounts.awaitingFirstPayment++;
        if (condition.delinquent) subscriptionCounts.delinquent++;
        if (condition.effectiveCancellation) subscriptionCounts.effectivelyCancelled++;
        if (condition.pendingCommercialSetup) subscriptionCounts.pendingCommercialSetup++;
        if (subscription.status === 'CURRENT' && !condition.trial && !condition.awaitingFirstPayment && !condition.pendingCommercialSetup && !condition.effectiveCancellation) subscriptionCounts.paidCurrent++;
      }

      let mrr = new Prisma.Decimal(0);
      for (const subscription of subscriptions) {
        const condition = conditions.get(subscription.id)!;
        if (subscription.status === 'CURRENT' && subscription.firstPaidPeriodStartedAt && subscription.firstPaidPeriodStartedAt <= referenceAt && !condition.effectiveCancellation && !condition.trial && !condition.awaitingFirstPayment && !condition.pendingCommercialSetup) mrr = mrr.add(subscription.contractedPrice);
      }
      let upcoming = new Prisma.Decimal(0); let overdue = new Prisma.Decimal(0);
      for (const subscription of subscriptions) for (const charge of subscription.charges) {
        const balance = chargeBalance(charge);
        if (!balance.gt(0) || charge.cancelledAt) continue;
        if (recifeCivilDate(charge.dueDate) < today) overdue = overdue.add(balance); else upcoming = upcoming.add(balance);
      }
      let received = new Prisma.Decimal(0);
      for (const settlement of settlements) {
        if (settlement.charge.cancelledAt) continue;
        const eventDate = settlement.kind === 'REVERSAL' ? settlement.effectiveAt : settlement.receivedAt;
        if (inRange(eventDate, monthStart, monthCutoff)) received = received.add(settlement.amount);
      }
      return {
        referenceAt: referenceAt.toISOString(), timezone: 'America/Recife',
        organizations: organizationCounts,
        subscriptions: subscriptionCounts,
        monthly: { newOrganizations: new Set(organizationCreatedEvents.map((event) => event.targetId)).size, newCommercialAccounts: new Set(commercialAccountCreatedEvents.map((event) => event.targetId)).size, effectiveCancellations: subscriptions.filter((subscription) => inRange(subscription.effectiveCancellationAt, monthStart, monthCutoff)).length, operationalDeactivations: new Set(deactivationEvents.map((event) => event.targetId)).size },
        financial: { mrr: money(mrr), receivedRevenue: money(received), pendingRevenue: { upcoming: money(upcoming), overdue: money(overdue), total: money(upcoming.add(overdue)) } },
      };
    });
  }
}

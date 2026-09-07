import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { chargeBalance } from '../platform/billing/commercial-access';
import { addCivilMonths, recifeCivilDate, recifeMidnight } from '../platform/billing/civil-dates';
import { deriveSubscriptionConditions } from '../platform/subscriptions/subscriptions.service';
import { deriveFinancialStanding } from '../platform/billing/financial-standing';
import { AuditAction, AuditTargetType } from '../platform/audit-events/dto/list-audit-events.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const subscriptionSelect = {
  id: true, commercialAccountId: true, status: true, contractedPrice: true,
  createdAt: true,
  trialEnabled: true, trialStartsAt: true, trialEndsAt: true,
  firstPaymentReceivedAt: true, firstPaidPeriodStartedAt: true,
  cancellationRequestedAt: true, effectiveCancellationAt: true, migratedAt: true, regularizedAt: true, commercialStartAt: true,
  charges: { select: { amount: true, dueDate: true, nature: true, cancelledAt: true, settlements: { select: { amount: true } } } },
} as const;
const organizationSelect = { id: true, name: true, operationalStatus: true, commercialAccountId: true } as const;
const settlementSelect = { amount: true, kind: true, receivedAt: true, effectiveAt: true, charge: { select: { cancelledAt: true } } } as const;
type SubscriptionRow = Prisma.SubscriptionGetPayload<{ select: typeof subscriptionSelect }>;

function money(value: Prisma.Decimal) { return value.toFixed(2); }
function inRange(value: Date | null, from: Date, to: Date) { return !!value && value >= from && value < to; }
function monthStart(month: string) { return recifeMidnight(`${month}-01`); }
function nextMonth(month: string) { return addCivilMonths(`${month}-01`, 1).slice(0, 7); }
function monthDifference(from: string, to: string) {
  const a = new Date(`${from}-01T12:00:00Z`); const b = new Date(`${to}-01T12:00:00Z`);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
}
function jsonValue(value: Prisma.JsonValue | null | undefined, key: string) {
  return value && typeof value === 'object' && !Array.isArray(value) && key in value ? (value as Record<string, Prisma.JsonValue>)[key] : undefined;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async workshopSummary(principal: AuthenticatedPrincipal, asOf = new Date()) {
    if (principal.role !== 'ADMIN' || !principal.organizationId) throw new ForbiddenException('Organization Admin access required');
    const organizationId = principal.organizationId;
    const result = await this.prisma.$transaction(async (tx) => {
      const [organization, customers, vehicles, quotes, workOrders, payments, expenses, directSales, subscription] = await Promise.all([
        tx.organization.findFirst({ where: { id: organizationId }, select: { id: true, name: true, phone: true, email: true, document: true } }),
        tx.customer.count({ where: { organizationId, active: true } }),
        tx.vehicle.count({ where: { organizationId, active: true } }),
        tx.quote.count({ where: { organizationId, status: { not: 'CANCELLED' } } }),
        tx.workOrder.count({ where: { organizationId, status: { not: 'CANCELLED' } } }),
        tx.payment.count({ where: { organizationId, status: 'CONFIRMED' } }),
        tx.expense.count({ where: { organizationId, status: { not: 'CANCELLED' } } }),
        tx.directSale.count({ where: { organizationId, status: 'CONFIRMED' } }),
        tx.subscription.findFirst({
          where: { commercialAccount: { organizations: { some: { id: organizationId } } }, status: { not: 'ENDED' } },
          orderBy: { createdAt: 'desc' },
          select: { trialEnabled: true, trialStartsAt: true, trialEndsAt: true },
        }),
      ]);
      if (!organization) throw new NotFoundException('Organization not found');
      return { organization, customers, vehicles, quotes, workOrders, payments, expenses, directSales, subscription };
    });
    const trial = this.trialStatus(result.subscription, asOf);
    return {
      referenceAt: asOf.toISOString(),
      timezone: 'America/Recife',
      organization: { id: result.organization.id, name: result.organization.name },
      trial,
      checklist: [
        { key: 'WORKSHOP_DETAILS', label: 'Complete os dados da oficina', completed: Boolean(result.organization.name.trim() && result.organization.phone?.trim() && result.organization.email?.trim()), href: '/app/settings' },
        { key: 'FIRST_CUSTOMER', label: 'Cadastre seu primeiro Customer', completed: result.customers > 0, href: '/app/customers/new' },
        { key: 'FIRST_VEHICLE', label: 'Cadastre seu primeiro Vehicle', completed: result.vehicles > 0, href: '/app/vehicles/new' },
        { key: 'FIRST_QUOTE', label: 'Crie seu primeiro Quote', completed: result.quotes > 0, href: '/app/quotes/new' },
        { key: 'FIRST_WORK_ORDER', label: 'Registre seu primeiro Work Order', completed: result.workOrders > 0, href: '/app/work-orders/new' },
        { key: 'FIRST_FINANCE_RECORD', label: 'Registre sua primeira movimentação financeira', completed: result.payments > 0 || result.expenses > 0 || result.directSales > 0, href: '/app/finance' },
      ],
    };
  }

  private trialStatus(subscription: { trialEnabled: boolean; trialStartsAt: Date | null; trialEndsAt: Date | null } | null, asOf: Date) {
    if (!subscription?.trialEnabled || !subscription.trialStartsAt || !subscription.trialEndsAt) return null;
    const active = asOf >= subscription.trialStartsAt && asOf < subscription.trialEndsAt;
    const remainingDays = active ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - asOf.getTime()) / 86400000)) : 0;
    return {
      status: active ? 'ACTIVE' : 'EXPIRED',
      endsAt: subscription.trialEndsAt.toISOString(),
      remainingDays,
      message: active ? `Trial Period ativo; ${remainingDays} ${remainingDays === 1 ? 'dia' : 'dias'} restantes.` : 'Trial Period encerrado; seus dados continuam disponíveis para consulta e exportação.',
    };
  }

  private buildSeries(input: {
    from: string; to: string; currentMonth: string; referenceAt: Date;
    organizations: Array<{ id: string; createdAt: Date; operationalStatus: string; commercialAccountId: string | null }>;
    subscriptions: Array<SubscriptionRow>; settlements: Array<Prisma.ChargeSettlementGetPayload<{ select: typeof settlementSelect }>>;
    auditEvents: Array<{ targetType: string; targetId: string; action: string; occurredAt: Date; before: Prisma.JsonValue | null; after: Prisma.JsonValue | null }>;
  }) {
    const months: Array<{ month: string; mrr: string; organizations: number; receivedRevenue: string; newOrganizations: number; newCommercialAccounts: number; effectiveCancellations: number; operationalDeactivations: number }> = [];
    let month = input.from;
    while (month <= input.to) {
      const start = monthStart(month);
      const end = monthStart(nextMonth(month));
      const cutoff = month === input.currentMonth ? input.referenceAt : new Date(end.getTime() - 1);
      const eventEnd = new Date(cutoff.getTime() + 1);
      const events = input.auditEvents;
      const eventsAtCutoff = events.filter((event) => event.occurredAt <= cutoff);

      // Organizations are retained after deactivation. Their historical quantity
      // is therefore the civil closing count of created Organizations, while
      // deactivation remains a separate event series.
      const organizations = input.organizations.filter((organization) => organization.createdAt <= cutoff).length;

      let mrr = new Prisma.Decimal(0);
      for (const subscription of input.subscriptions) {
        if (subscription.createdAt > cutoff || !subscription.firstPaidPeriodStartedAt || subscription.firstPaidPeriodStartedAt > cutoff) continue;
        if (subscription.effectiveCancellationAt && subscription.effectiveCancellationAt <= cutoff) continue;
        const historicalStatus = subscription.status === 'ENDED' && (!subscription.effectiveCancellationAt || subscription.effectiveCancellationAt > cutoff) ? 'CURRENT' : subscription.status;
        const condition = deriveSubscriptionConditions({ ...subscription, status: historicalStatus }, cutoff);
        if (condition.trial || condition.awaitingFirstPayment || condition.pendingCommercialSetup || condition.effectiveCancellation) continue;
        let price = subscription.contractedPrice;
        for (const event of events.filter((candidate) => candidate.targetType === AuditTargetType.SUBSCRIPTION && candidate.targetId === subscription.id && (candidate.action === AuditAction.SUBSCRIPTION_PLAN_CHANGE_APPLIED || candidate.action === AuditAction.SUBSCRIPTION_RECURRING_ADJUSTMENT_APPLIED) && candidate.occurredAt > cutoff).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())) {
          const previousPrice = jsonValue(event.before, 'contractedPrice');
          if (typeof previousPrice === 'string' || typeof previousPrice === 'number') price = new Prisma.Decimal(String(previousPrice));
        }
        mrr = mrr.add(price);
      }

      let receivedRevenue = new Prisma.Decimal(0);
      for (const settlement of input.settlements) {
        if (settlement.charge.cancelledAt && settlement.charge.cancelledAt <= cutoff) continue;
        const eventDate = settlement.kind === 'REVERSAL' ? settlement.effectiveAt : settlement.receivedAt;
        if (inRange(eventDate, start, eventEnd)) receivedRevenue = receivedRevenue.add(settlement.amount);
      }
      const inMonth = (event: { occurredAt: Date }) => inRange(event.occurredAt, start, eventEnd);
      const organizationEvents = eventsAtCutoff.filter((event) => event.targetType === AuditTargetType.ORGANIZATION);
      months.push({
        month, mrr: money(mrr), organizations,
        receivedRevenue: money(receivedRevenue),
        newOrganizations: new Set(organizationEvents.filter((event) => event.action === AuditAction.ORGANIZATION_CREATED && inMonth(event)).map((event) => event.targetId)).size,
        newCommercialAccounts: new Set(eventsAtCutoff.filter((event) => event.targetType === AuditTargetType.COMMERCIAL_ACCOUNT && event.action === AuditAction.COMMERCIAL_ACCOUNT_CREATED && inMonth(event)).map((event) => event.targetId)).size,
        effectiveCancellations: input.subscriptions.filter((subscription) => inRange(subscription.effectiveCancellationAt, start, eventEnd)).length,
        operationalDeactivations: new Set(organizationEvents.filter((event) => event.action === AuditAction.ORGANIZATION_DEACTIVATED && inMonth(event)).map((event) => event.targetId)).size,
      });
      month = nextMonth(month);
    }
    return months;
  }

  async summary(principal: AuthenticatedPrincipal, query: DashboardQueryDto = {}) {
    if (principal.role !== 'SUPER_ADMIN') throw new ForbiddenException('Platform access requires Super Admin');
    const referenceAt = query.asOf ? new Date(query.asOf) : new Date();
    if (!Number.isFinite(referenceAt.getTime())) throw new BadRequestException('asOf must be a valid date');
    const civil = recifeCivilDate(referenceAt);
    const currentMonth = civil.slice(0, 7);
    const currentMonthStart = monthStart(currentMonth);
    const currentMonthEnd = monthStart(nextMonth(currentMonth));
    const monthCutoff = referenceAt < currentMonthEnd ? new Date(referenceAt.getTime() + 1) : currentMonthEnd;
    const today = civil;

    return this.prisma.$transaction(async (tx) => {
      const [organizations, subscriptions, settlements, auditEvents] = await Promise.all([
        tx.organization.findMany({ where: { createdAt: { lte: referenceAt } }, select: { ...organizationSelect, createdAt: true } }),
        tx.subscription.findMany({ where: { createdAt: { lte: referenceAt } }, select: { ...subscriptionSelect, charges: { where: { createdAt: { lte: referenceAt } }, select: { amount: true, dueDate: true, nature: true, cancelledAt: true, settlements: { where: { OR: [{ kind: 'RECEIPT', receivedAt: { lte: referenceAt } }, { kind: 'REVERSAL', effectiveAt: { lte: referenceAt } }] }, select: { amount: true } } } } } }),
        tx.chargeSettlement.findMany({ where: { OR: [{ receivedAt: { lte: referenceAt } }, { effectiveAt: { lte: referenceAt } }] }, select: settlementSelect }),
        tx.auditEvent.findMany({ where: { occurredAt: { lte: referenceAt } }, select: { targetType: true, targetId: true, action: true, occurredAt: true, before: true, after: true } }),
      ]);
      const conditions = new Map<string, ReturnType<typeof deriveSubscriptionConditions>>();
      for (const subscription of subscriptions) conditions.set(subscription.id, deriveSubscriptionConditions(subscription, referenceAt));
      const byAccount = new Map<string, SubscriptionRow[]>();
      for (const subscription of subscriptions) if (subscription.commercialAccountId) byAccount.set(subscription.commercialAccountId, [...(byAccount.get(subscription.commercialAccountId) ?? []), subscription]);

      const organizationCounts = { total: organizations.length, current: 0, dueSoon: 0, overdue: 0, paymentBlocked: 0, suspended: 0 };
      const attentionOrganizations: Array<{ id: string; name: string; reasons: string[] }> = [];
      for (const organization of organizations) {
        if (organization.operationalStatus === 'SUSPENDED') organizationCounts.suspended++;
        const accountSubscriptions = organization.commercialAccountId ? byAccount.get(organization.commercialAccountId) ?? [] : [];
        const subscription = accountSubscriptions.find((candidate) => candidate.status !== 'ENDED');
        const condition = subscription ? conditions.get(subscription.id)! : null;
        const openCharge = subscription?.charges.filter((charge) => !charge.cancelledAt && chargeBalance(charge).gt(0)).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
        const standing = openCharge && !condition?.pendingCommercialSetup ? deriveFinancialStanding(openCharge.dueDate, referenceAt).status : 'CURRENT';
        if (standing === 'CURRENT') organizationCounts.current++;
        if (standing === 'DUE_SOON') organizationCounts.dueSoon++;
        if (standing === 'OVERDUE') organizationCounts.overdue++;
        if (standing === 'PAYMENT_BLOCKED') organizationCounts.paymentBlocked++;
        const reasons = [
          ...(standing === 'DUE_SOON' ? ['DUE_SOON'] : []),
          ...(standing === 'OVERDUE' ? ['OVERDUE'] : []),
          ...(standing === 'PAYMENT_BLOCKED' ? ['PAYMENT_BLOCKED'] : []),
          ...(organization.operationalStatus === 'SUSPENDED' ? ['SUSPENDED'] : []),
        ];
        if (reasons.length && attentionOrganizations.length < 5) attentionOrganizations.push({ id: organization.id, name: organization.name, reasons });
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
        if (inRange(eventDate, currentMonthStart, monthCutoff)) received = received.add(settlement.amount);
      }
      return {
        referenceAt: referenceAt.toISOString(), timezone: 'America/Recife',
        organizations: organizationCounts,
        financial: { receivedRevenue: money(received), openWithinDue: money(upcoming), overdue: money(overdue) },
        attentionOrganizations,
      };
    });
  }
}

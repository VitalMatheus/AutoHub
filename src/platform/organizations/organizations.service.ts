import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';
import { OrganizationTransitionDto } from './dto/organization-transition.dto';
import { recifeCivilDate, recifeMidnight } from '../billing/civil-dates';
import { addCivilDays } from '../billing/civil-dates';
import { chargeBalance } from '../billing/commercial-access';
import { deriveSubscriptionConditions } from '../subscriptions/subscriptions.service';
import { ListOrganizationsDto, OrganizationCommercialAccessFilter, OrganizationLifecycleFilter, OrganizationSort } from './dto/list-organizations.dto';
import { deriveFinancialStanding } from '../billing/financial-standing';
import { RegularizeCommercialSetupDto } from './dto/regularize-commercial-setup.dto';

const organizationSelect = {
  id: true, name: true, document: true, phone: true, email: true, addressLine1: true, addressLine2: true,
  city: true, state: true, postalCode: true, notes: true, operationalStatus: true, createdAt: true, updatedAt: true,
  commercialAccount: { select: {
    id: true, name: true, billingEmail: true, billingDocument: true, primaryContactUserId: true,
    primaryContactOrganizationId: true,
    primaryContact: { select: { id: true, name: true, email: true, role: true, status: true, organizationId: true } },
    subscriptions: { orderBy: { createdAt: 'desc' as const }, take: 1, select: {
      id: true, status: true, contractedPrice: true, contractedCurrency: true, contractedInterval: true,
      contractedOrganizationLimit: true, contractedUserLimit: true, contractedWorkOrderLimit: true,
      migratedAt: true, regularizedAt: true, commercialStartAt: true, trialEnabled: true, trialStartsAt: true,
      firstDueDate: true, billingDay: true,
      trialEndsAt: true, firstPaymentReceivedAt: true, firstPaidPeriodStartedAt: true, currentPeriodStart: true,
      currentPeriodEnd: true, cancellationRequestedAt: true, effectiveCancellationAt: true,
      planVersion: { select: { id: true, version: true, plan: { select: { id: true, name: true } } } },
      charges: { select: { nature: true, dueDate: true, amount: true, cancelledAt: true, settlements: { select: { amount: true } } } },
    } },
    organizations: { select: { id: true, operationalStatus: true, users: { where: { status: { not: 'DISABLED' } }, select: { id: true } } } },
  } },
} as const;

const organizationRegistrationSelect = {
  id: true, name: true, document: true, phone: true, email: true, addressLine1: true, addressLine2: true,
  city: true, state: true, postalCode: true, notes: true, operationalStatus: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly auditEvents: AuditEventsService) {}

  private normalizeEmail(email: string) { return email.trim().toLowerCase(); }
  private normalizeDocument(document: string) { return document.replace(/\D/g, ''); }
  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async create(principal: AuthenticatedPrincipal, dto: CreateOrganizationDto) {
    const firstDueDate = new Date(`${dto.firstDueDate}T00:00:00.000Z`);
    if (!Number.isFinite(firstDueDate.getTime()) || firstDueDate.toISOString().slice(0, 10) !== dto.firstDueDate) {
      throw new BadRequestException('firstDueDate must be a valid civil date');
    }
    const contractedPrice = new Prisma.Decimal(dto.contractedPrice ?? '79.00');
    if (!contractedPrice.gt(0)) throw new BadRequestException('contractedPrice must be greater than zero');
    const activationSecret = randomBytes(32).toString('base64url');
    const expiresDays = this.config.get<number>('ACTIVATION_TOKEN_TTL_DAYS') ?? 3;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const version = await tx.planVersion.findFirst({ where: { plan: { name: 'AutoHub Básico', archivedAt: null }, status: 'PUBLISHED' }, orderBy: [{ publishedAt: 'desc' }, { version: 'desc' }], select: { id: true, status: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, workOrderLimit: true, gracePeriodDays: true, plan: { select: { archivedAt: true } } } });
        if (!version) throw new BadRequestException('Basic Plan is not available');
        if (version.status !== 'PUBLISHED' || version.plan.archivedAt) throw new ConflictException('Only published Plan Versions from an active Plan can be contracted');
        const commercialAccount = await tx.commercialAccount.create({ data: { name: dto.name.trim(), billingEmail: dto.email ? this.normalizeEmail(dto.email) : undefined, billingDocument: dto.document ? this.normalizeDocument(dto.document) : undefined } });
        const organization = await tx.organization.create({ data: {
          commercialAccountId: commercialAccount.id,
          name: dto.name.trim(), document: dto.document ? this.normalizeDocument(dto.document) : undefined, phone: dto.phone, email: dto.email ? this.normalizeEmail(dto.email) : undefined,
          addressLine1: dto.addressLine1, addressLine2: dto.addressLine2, city: dto.city, state: dto.state, postalCode: dto.postalCode, notes: dto.notes,
        }, select: organizationRegistrationSelect });
        const admin = await tx.user.create({ data: {
          organizationId: organization.id, name: dto.admin.name.trim(), email: this.normalizeEmail(dto.admin.email), role: 'ADMIN', status: 'PENDING_ACTIVATION',
        }, select: { id: true, name: true, email: true, role: true, status: true, organizationId: true } });
        await tx.actionToken.create({ data: { userId: admin.id, purpose: 'ACTIVATE_ACCOUNT', tokenHash: this.hashToken(activationSecret), expiresAt: new Date(Date.now() + expiresDays * 86400000) } });
        await tx.commercialAccount.update({ where: { id: commercialAccount.id }, data: { primaryContactOrganizationId: organization.id, primaryContactUserId: admin.id } });
        const subscription = await tx.subscription.create({ data: {
          commercialAccountId: commercialAccount.id, planVersionId: version.id, status: 'CURRENT',
          contractedPrice, contractedCurrency: version.currency, contractedInterval: version.interval,
          contractedOrganizationLimit: version.organizationLimit, contractedUserLimit: version.userLimit,
          contractedWorkOrderLimit: version.workOrderLimit, contractedGracePeriodDays: version.gracePeriodDays,
          commercialStartAt: new Date(), firstDueDate, billingDay: dto.billingDay,
          trialEnabled: false, trialStartsAt: null, trialEndsAt: null,
        }, select: { id: true, planVersionId: true, status: true, trialEnabled: true, trialStartsAt: true, trialEndsAt: true, contractedPrice: true, firstDueDate: true, billingDay: true } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.COMMERCIAL_ACCOUNT_CREATED, targetType: AuditTargetType.COMMERCIAL_ACCOUNT, targetId: commercialAccount.id, commercialAccountId: commercialAccount.id, after: { name: commercialAccount.name, organizationId: organization.id, primaryContactId: admin.id } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.ORGANIZATION_CREATED, targetType: AuditTargetType.ORGANIZATION, targetId: organization.id, organizationId: organization.id, after: { name: organization.name, operationalStatus: organization.operationalStatus, initialAdminId: admin.id, initialAdminName: admin.name, initialAdminEmail: admin.email } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.USER_INVITATION_ISSUED, targetType: AuditTargetType.USER, targetId: admin.id, organizationId: organization.id, after: { name: admin.name, email: admin.email, role: admin.role, status: admin.status } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CREATED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscription.id, commercialAccountId: commercialAccount.id, after: { planVersionId: subscription.planVersionId, status: subscription.status, firstDueDate: subscription.firstDueDate, billingDay: subscription.billingDay, trialEnabled: false, contractedPrice: subscription.contractedPrice } });
        const { commercialAccount: _commercialAccount, ...registeredOrganization } = organization as typeof organization & { commercialAccount?: unknown };
        return { organization: registeredOrganization, admin };
      });
      return { ...result, activationSecret };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Organization or admin already exists');
      throw error;
    }
  }

  async list(dto: ListOrganizationsDto = new ListOrganizationsDto()) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const search = dto.search?.trim();
    const normalizedDocument = search?.replace(/\D/g, '');
    const where: Prisma.OrganizationWhereInput = {
      ...(dto.operationalStatus ? { operationalStatus: dto.operationalStatus } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        ...(normalizedDocument ? [{ document: { contains: normalizedDocument } }] : []),
        { commercialAccount: { name: { contains: search, mode: 'insensitive' } } },
        { commercialAccount: { primaryContact: { name: { contains: search, mode: 'insensitive' } } } },
        { commercialAccount: { primaryContact: { email: { contains: search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const rows = await this.prisma.organization.findMany({ where, select: organizationSelect });
    const referenceAt = new Date();
    const projected = rows.map((row) => this.present(row, referenceAt));
    const filtered = projected.filter((row) =>
      (!dto.lifecycle?.length || dto.lifecycle.some((value) => row.lifecycle.includes(value))) &&
      (!dto.commercialAccess?.length || dto.commercialAccess.includes(row.commercialAccess as OrganizationCommercialAccessFilter)) &&
      (!dto.financialStanding?.length || dto.financialStanding.includes(row.financialStanding.status)),
    );
    filtered.sort(this.sorter(dto.sort ?? OrganizationSort.CREATED_AT_DESC));
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { data, meta: { page, pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) } };
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id }, select: { ...organizationSelect, users: { where: { role: 'ADMIN' }, select: { id: true, name: true, email: true, status: true } } } });
    if (!organization) throw new NotFoundException('Organization not found');
    return { ...this.present(organization), users: organization.users };
  }

  async regularizeCommercialSetup(principal: AuthenticatedPrincipal, id: string, dto: RegularizeCommercialSetupDto) {
    const firstDueDate = new Date(`${dto.firstDueDate}T00:00:00.000Z`);
    if (!Number.isFinite(firstDueDate.getTime()) || firstDueDate.toISOString().slice(0, 10) !== dto.firstDueDate) {
      throw new BadRequestException('firstDueDate must be a valid civil date');
    }
    const contractedPrice = new Prisma.Decimal(dto.contractedPrice);
    if (!contractedPrice.gt(0)) throw new BadRequestException('contractedPrice must be greater than zero');

    await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id }, select: {
        id: true, commercialAccountId: true,
        commercialAccount: { select: { subscriptions: { where: { status: { not: 'ENDED' } }, orderBy: { createdAt: 'desc' }, take: 1, select: {
          id: true, migratedAt: true, regularizedAt: true, contractedPrice: true, firstDueDate: true, billingDay: true,
        } } } },
      } });
      if (!organization) throw new NotFoundException('Organization not found');
      const subscription = organization.commercialAccount?.subscriptions[0];
      if (!subscription) throw new NotFoundException('Current Subscription not found');

      const alreadyMatches = subscription.firstDueDate?.getTime() === firstDueDate.getTime()
        && subscription.billingDay === dto.billingDay
        && subscription.contractedPrice.equals(contractedPrice);
      if (subscription.firstDueDate && subscription.billingDay !== null) {
        if (alreadyMatches) return;
        throw new ConflictException('Commercial setup is already configured with different values');
      }

      const regularizedAt = new Date();
      await tx.subscription.update({ where: { id: subscription.id }, data: {
        contractedPrice, firstDueDate, billingDay: dto.billingDay, regularizedAt,
        regularizationReason: 'Pending Commercial Setup regularized by Super Admin',
        trialEnabled: false,
      } });
      await this.auditEvents.record(tx, principal, {
        action: AuditAction.SUBSCRIPTION_MIGRATED_REGULARIZED, targetType: AuditTargetType.SUBSCRIPTION,
        targetId: subscription.id, commercialAccountId: organization.commercialAccountId ?? undefined,
        before: { contractedPrice: subscription.contractedPrice.toFixed(2), firstDueDate: subscription.firstDueDate, billingDay: subscription.billingDay },
        after: { contractedPrice: contractedPrice.toFixed(2), firstDueDate, billingDay: dto.billingDay, regularizedAt },
      });
    });
    return this.findOne(id);
  }

  private present(row: Prisma.OrganizationGetPayload<{ select: typeof organizationSelect }>, asOf = new Date()) {
    const account = row.commercialAccount;
    const subscription = account?.subscriptions[0];
    const contact = account?.primaryContact && account.primaryContact.role === 'ADMIN' && account.primaryContact.status === 'ACTIVE'
      ? account.primaryContact : null;
    const charges = subscription?.charges ?? [];
    const conditions = subscription ? deriveSubscriptionConditions(subscription, asOf) : {
      pendingCommercialSetup: false, trial: false, awaitingFirstPayment: false, delinquent: false,
      paymentGracePeriod: false, scheduledCancellation: false, effectiveCancellation: false, commercialAccess: 'PAYMENT_BLOCKED' as const,
    };
    // Legacy charges remain persisted, but Pending Commercial Setup must not
    // manufacture debt, delinquency, or a commercial block before the Super
    // Admin confirms the schedule.
    const commerciallyActiveCharges = conditions.pendingCommercialSetup ? [] : charges;
    const openCharges = commerciallyActiveCharges.filter((charge) => chargeBalance(charge).gt(0));
    const nextCharge = [...openCharges].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
    const financialStanding = deriveFinancialStanding(nextCharge?.dueDate ?? null, asOf);
    const blockDate = nextCharge ? recifeMidnight(addCivilDays(recifeCivilDate(nextCharge.dueDate), nextCharge.nature === 'RENEWAL' ? 6 : 1)) : null;
    const paidAmount = commerciallyActiveCharges.reduce((sum, charge) => sum.add(charge.amount.sub(chargeBalance(charge))), new Prisma.Decimal(0));
    const outstandingAmount = openCharges.reduce((sum, charge) => sum.add(chargeBalance(charge)), new Prisma.Decimal(0));
    const lifecycle: OrganizationLifecycleFilter[] = [];
    if (conditions.trial) lifecycle.push(OrganizationLifecycleFilter.TRIAL);
    if (conditions.pendingCommercialSetup) lifecycle.push(OrganizationLifecycleFilter.PENDING_COMMERCIAL_SETUP);
    if (conditions.awaitingFirstPayment) lifecycle.push(OrganizationLifecycleFilter.AWAITING_FIRST_PAYMENT);
    if (conditions.delinquent) lifecycle.push(OrganizationLifecycleFilter.DELINQUENT);
    if (conditions.effectiveCancellation) lifecycle.push(OrganizationLifecycleFilter.EFFECTIVELY_CANCELLED);
    if (subscription && subscription.firstPaymentReceivedAt && !conditions.effectiveCancellation && !conditions.trial) lifecycle.push(OrganizationLifecycleFilter.PAID_CURRENT);
    const activeOrganizations = account?.organizations.filter((organization) => organization.operationalStatus !== 'INACTIVE').length ?? 0;
    const activeUsers = account?.organizations.reduce((total, organization) => total + organization.users.length, 0) ?? 0;
    const administrativePending: string[] = [];
    if (subscription && activeOrganizations === 0) administrativePending.push('SUBSCRIPTION_WITHOUT_ACTIVE_ORGANIZATION');
    if (account && !contact) administrativePending.push('MISSING_PRIMARY_CONTACT');
    if (subscription && activeOrganizations > subscription.contractedOrganizationLimit) administrativePending.push('ORGANIZATION_LIMIT_EXCEEDED');
    if (subscription && activeUsers > subscription.contractedUserLimit) administrativePending.push('USER_LIMIT_EXCEEDED');
    return {
      ...row,
      financialStanding,
      commercialAccount: account ? { id: account.id, name: account.name, billingEmail: account.billingEmail, billingDocument: account.billingDocument } : null,
      primaryContact: contact,
      plan: subscription?.planVersion ? {
        ...subscription.planVersion.plan, version: subscription.planVersion.version, planVersionId: subscription.planVersion.id,
        contractedPrice: subscription.contractedPrice.toFixed(2), contractedCurrency: subscription.contractedCurrency,
        contractedInterval: subscription.contractedInterval, organizationLimit: subscription.contractedOrganizationLimit,
        userLimit: subscription.contractedUserLimit, workOrderLimit: subscription.contractedWorkOrderLimit,
      } : null,
      lifecycle,
      conditions,
      trial: { enabled: subscription?.trialEnabled ?? false, startsAt: subscription?.trialStartsAt ?? null, endsAt: subscription?.trialEndsAt ?? null },
      commercialSetup: { firstDueDate: subscription?.firstDueDate ?? null, billingDay: subscription?.billingDay ?? null },
      payment: { condition: conditions.delinquent && !conditions.pendingCommercialSetup ? 'OVERDUE' : outstandingAmount.isZero() ? 'PAID' : 'OPEN', paidAmount: paidAmount.toFixed(2), outstandingAmount: outstandingAmount.toFixed(2) },
      commercialAccess: conditions.commercialAccess,
      effectiveAccess: { allowed: row.operationalStatus === 'ACTIVE' && conditions.commercialAccess !== 'PAYMENT_BLOCKED', operationalStatus: row.operationalStatus, commercialAccess: conditions.commercialAccess },
      nextBillingDate: subscription?.currentPeriodEnd ?? nextCharge?.dueDate ?? null,
      blockDate,
      administrativePending,
    };
  }

  private sorter(sort: OrganizationSort) {
    const direction = sort.startsWith('-') ? -1 : 1;
    const field = sort.replace(/^-/, '') as 'name' | 'createdAt' | 'operationalStatus';
    return (a: ReturnType<OrganizationsService['present']>, b: ReturnType<OrganizationsService['present']>) => {
      const left = field === 'name' ? a.name.toLocaleLowerCase() : field === 'createdAt' ? a.createdAt.getTime() : a.operationalStatus;
      const right = field === 'name' ? b.name.toLocaleLowerCase() : field === 'createdAt' ? b.createdAt.getTime() : b.operationalStatus;
      return (left < right ? -1 : left > right ? 1 : a.id.localeCompare(b.id)) * direction;
    };
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateOrganizationDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.organization.findUnique({ where: { id }, select: organizationSelect });
        if (!before) throw new NotFoundException('Organization not found');
        const data = { ...dto, name: dto.name?.trim(), email: dto.email ? this.normalizeEmail(dto.email) : undefined, document: dto.document ? this.normalizeDocument(dto.document) : undefined };
        const organization = await tx.organization.update({ where: { id }, data, select: organizationSelect });
        const fields = ['name', 'document', 'phone', 'email', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode'] as const;
        const changed = fields.filter((field) => before[field] !== organization[field]);
        if (changed.length) {
          const beforeSnapshot = Object.fromEntries(changed.map((field) => [field, before[field]]));
          const afterSnapshot = Object.fromEntries(changed.map((field) => [field, organization[field]]));
          await this.auditEvents.record(tx, principal, { action: AuditAction.ORGANIZATION_UPDATED, targetType: AuditTargetType.ORGANIZATION, targetId: id, organizationId: id, before: beforeSnapshot, after: afterSnapshot });
        }
        return organization;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Organization not found');
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Organization document already exists');
      throw error;
    }
  }

  async transition(principal: AuthenticatedPrincipal, id: string, action: 'activate' | 'deactivate' | 'suspend' | 'reactivate', dto?: OrganizationTransitionDto) {
    const transitions = {
      activate: { from: ['INACTIVE'], to: 'ACTIVE', audit: AuditAction.ORGANIZATION_ACTIVATED },
      deactivate: { from: ['ACTIVE', 'SUSPENDED'], to: 'INACTIVE', audit: AuditAction.ORGANIZATION_DEACTIVATED },
      suspend: { from: ['ACTIVE'], to: 'SUSPENDED', audit: AuditAction.ORGANIZATION_SUSPENDED },
      reactivate: { from: ['SUSPENDED'], to: 'ACTIVE', audit: AuditAction.ORGANIZATION_REACTIVATED },
    } as const;
    const rule = transitions[action];
    if ((action === 'deactivate' || action === 'suspend') && !dto?.reason?.trim()) throw new BadRequestException('Reason is required');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.organization.findUnique({ where: { id }, select: organizationSelect });
        if (!before) throw new NotFoundException('Organization not found');
        if (before.operationalStatus === rule.to) return before;
        if (!(rule.from as readonly string[]).includes(before.operationalStatus)) {
          throw new ConflictException({ code: 'ORGANIZATION_INVALID_TRANSITION', detail: `Organization cannot ${action} from ${before.operationalStatus}.` });
        }
        if (action === 'activate' || action === 'reactivate') {
          await this.enforceOrganizationLimit(tx, before.commercialAccount?.id ?? null);
        }
        const organization = await tx.organization.update({ where: { id }, data: { operationalStatus: rule.to }, select: organizationSelect });
        if (action === 'deactivate' || action === 'suspend') {
          await tx.session.updateMany({ where: { user: { organizationId: id }, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        await this.auditEvents.record(tx, principal, { action: rule.audit, targetType: AuditTargetType.ORGANIZATION, targetId: id, organizationId: id, reason: dto?.reason?.trim(), before: { operationalStatus: before.operationalStatus }, after: { operationalStatus: organization.operationalStatus } });
        return organization;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Organization not found');
      throw error;
    }
  }

  private async enforceOrganizationLimit(tx: any, commercialAccountId: string | null) {
    if (!commercialAccountId) return;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${commercialAccountId}, 0))`;
    const subscription = await tx.subscription.findFirst({
      where: { commercialAccountId, status: { not: 'ENDED' } },
      orderBy: { createdAt: 'desc' },
      select: { contractedOrganizationLimit: true },
    });
    if (!subscription) return;
    const count = await tx.organization.count({
      where: { commercialAccountId, operationalStatus: { not: 'INACTIVE' } },
    });
    if (count >= subscription.contractedOrganizationLimit) {
      throw new ConflictException({
        code: 'PLAN_ORGANIZATION_LIMIT_REACHED',
        detail: `The Commercial Account allows at most ${subscription.contractedOrganizationLimit} non-inactive Organizations.`,
      });
    }
  }

}

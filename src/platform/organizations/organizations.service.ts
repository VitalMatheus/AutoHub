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
import { chargeBalance, deriveCommercialAccess } from '../billing/commercial-access';
import { deriveSubscriptionConditions } from '../subscriptions/subscriptions.service';
import { ListOrganizationsDto, OrganizationCommercialAccessFilter, OrganizationLifecycleFilter, OrganizationSort } from './dto/list-organizations.dto';

const organizationSelect = {
  id: true, name: true, document: true, phone: true, email: true, addressLine1: true, addressLine2: true,
  city: true, state: true, postalCode: true, operationalStatus: true, createdAt: true, updatedAt: true,
  commercialAccount: { select: {
    id: true, name: true, billingEmail: true, billingDocument: true, primaryContactUserId: true,
    primaryContactOrganizationId: true,
    primaryContact: { select: { id: true, name: true, email: true, role: true, status: true, organizationId: true } },
    subscriptions: { orderBy: { createdAt: 'desc' as const }, take: 1, select: {
      id: true, status: true, contractedPrice: true, contractedCurrency: true, contractedInterval: true,
      contractedOrganizationLimit: true, contractedUserLimit: true, contractedWorkOrderLimit: true,
      migratedAt: true, regularizedAt: true, commercialStartAt: true, trialEnabled: true, trialStartsAt: true,
      trialEndsAt: true, firstPaymentReceivedAt: true, firstPaidPeriodStartedAt: true, currentPeriodStart: true,
      currentPeriodEnd: true, cancellationRequestedAt: true, effectiveCancellationAt: true,
      planVersion: { select: { id: true, version: true, plan: { select: { id: true, name: true } } } },
      charges: { select: { nature: true, dueDate: true, amount: true, cancelledAt: true, settlements: { select: { amount: true } } } },
    } },
    organizations: { select: { id: true, operationalStatus: true, users: { where: { status: { not: 'DISABLED' } }, select: { id: true } } } },
  } },
} as const;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly auditEvents: AuditEventsService) {}

  private normalizeEmail(email: string) { return email.trim().toLowerCase(); }
  private normalizeDocument(document: string) { return document.replace(/\D/g, ''); }
  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async create(principal: AuthenticatedPrincipal, dto: CreateOrganizationDto) {
    const adminName = dto.admin?.name ?? dto.adminName;
    const adminEmail = dto.admin?.email ?? dto.adminEmail;
    if (!adminName || !adminEmail) throw new BadRequestException('First Organization Admin is required');
    const activationToken = randomBytes(32).toString('base64url');
    const expiresDays = this.config.get<number>('ACTIVATION_TOKEN_TTL_DAYS') ?? 3;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const version = dto.planVersionId
          ? await tx.planVersion.findUnique({ where: { id: dto.planVersionId }, select: { id: true, status: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, workOrderLimit: true, gracePeriodDays: true, plan: { select: { archivedAt: true } } } })
          : await tx.planVersion.findFirst({ where: { plan: { name: 'AutoHub Básico', archivedAt: null }, status: 'PUBLISHED' }, orderBy: [{ publishedAt: 'desc' }, { version: 'desc' }], select: { id: true, status: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, workOrderLimit: true, gracePeriodDays: true, plan: { select: { archivedAt: true } } } });
        if (!version) throw new BadRequestException(dto.planVersionId ? 'Plan Version not found' : 'Basic Plan is not available');
        if (version.status !== 'PUBLISHED' || version.plan.archivedAt) throw new ConflictException('Only published Plan Versions from an active Plan can be contracted');
        const explicitTrialStart = dto.trialStartsAt ? new Date(dto.trialStartsAt) : null;
        const trialEndsAt = explicitTrialStart ? new Date(explicitTrialStart) : null;
        if (trialEndsAt) trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + 14);
        let existingSubscription: any = null;
        const existingAccount = dto.commercialAccountId
          ? await tx.commercialAccount.findUnique({ where: { id: dto.commercialAccountId }, select: { id: true, name: true, billingEmail: true, billingDocument: true, primaryContactOrganizationId: true, primaryContactUserId: true, createdAt: true, updatedAt: true } })
          : null;
        if (dto.commercialAccountId && !existingAccount) throw new NotFoundException('Commercial Account not found');
        if (existingAccount) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${existingAccount.id}, 0))`;
          existingSubscription = await tx.subscription.findFirst({ where: { commercialAccountId: existingAccount.id, status: { not: 'ENDED' } }, orderBy: { createdAt: 'desc' }, select: { id: true, planVersionId: true, status: true, trialEnabled: true, trialStartsAt: true, trialEndsAt: true, contractedPrice: true, contractedOrganizationLimit: true } });
          const organizationCount = await tx.organization.count({ where: { commercialAccountId: existingAccount.id, operationalStatus: { not: 'INACTIVE' } } });
          if (existingSubscription && organizationCount >= existingSubscription.contractedOrganizationLimit) throw new ConflictException({ code: 'PLAN_ORGANIZATION_LIMIT_REACHED', detail: `The Commercial Account allows at most ${existingSubscription.contractedOrganizationLimit} non-inactive Organizations.` });
        }
        const commercialAccount = existingAccount ?? await tx.commercialAccount.create({ data: { name: dto.name.trim(), billingEmail: dto.email ? this.normalizeEmail(dto.email) : undefined, billingDocument: dto.document ? this.normalizeDocument(dto.document) : undefined } });
        const organization = await tx.organization.create({ data: {
          commercialAccountId: commercialAccount.id,
          name: dto.name.trim(), document: dto.document ? this.normalizeDocument(dto.document) : undefined, phone: dto.phone, email: dto.email ? this.normalizeEmail(dto.email) : undefined,
          addressLine1: dto.addressLine1, addressLine2: dto.addressLine2, city: dto.city, state: dto.state, postalCode: dto.postalCode,
        }, select: organizationSelect });
        const admin = await tx.user.create({ data: {
          organizationId: organization.id, name: adminName.trim(), email: this.normalizeEmail(adminEmail), role: 'ADMIN', status: 'PENDING_ACTIVATION',
        }, select: { id: true, name: true, email: true, role: true, status: true, organizationId: true } });
        await tx.actionToken.create({ data: { userId: admin.id, purpose: 'ACTIVATE_ACCOUNT', tokenHash: this.hashToken(activationToken), expiresAt: new Date(Date.now() + expiresDays * 86400000) } });
        if (!existingAccount || !existingAccount.primaryContactUserId) await tx.commercialAccount.update({ where: { id: commercialAccount.id }, data: { primaryContactOrganizationId: organization.id, primaryContactUserId: admin.id } });
        const subscription = existingSubscription ?? await tx.subscription.create({ data: {
          commercialAccountId: commercialAccount.id, planVersionId: version.id, status: 'SCHEDULED',
          contractedPrice: version.price, contractedCurrency: version.currency, contractedInterval: version.interval,
          contractedOrganizationLimit: version.organizationLimit, contractedUserLimit: version.userLimit,
          contractedWorkOrderLimit: version.workOrderLimit, contractedGracePeriodDays: version.gracePeriodDays,
          trialEnabled: dto.trialEnabled !== false, trialStartsAt: dto.trialEnabled !== false ? explicitTrialStart : null,
          trialEndsAt: dto.trialEnabled !== false ? trialEndsAt : null, commercialStartAt: dto.trialEnabled !== false ? explicitTrialStart : null,
        }, select: { id: true, planVersionId: true, status: true, trialEnabled: true, trialStartsAt: true, trialEndsAt: true, contractedPrice: true } });
        if (!existingAccount) await this.auditEvents.record(tx, principal, { action: AuditAction.COMMERCIAL_ACCOUNT_CREATED, targetType: AuditTargetType.COMMERCIAL_ACCOUNT, targetId: commercialAccount.id, commercialAccountId: commercialAccount.id, after: { name: commercialAccount.name, organizationId: organization.id, primaryContactId: admin.id } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.ORGANIZATION_CREATED, targetType: AuditTargetType.ORGANIZATION, targetId: organization.id, organizationId: organization.id, after: { name: organization.name, operationalStatus: organization.operationalStatus, initialAdminId: admin.id, initialAdminName: admin.name, initialAdminEmail: admin.email } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.USER_INVITATION_ISSUED, targetType: AuditTargetType.USER, targetId: admin.id, organizationId: organization.id, after: { name: admin.name, email: admin.email, role: admin.role, status: admin.status } });
        if (!existingSubscription) await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CREATED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscription.id, commercialAccountId: commercialAccount.id, after: { planVersionId: subscription.planVersionId, status: subscription.status, trialEnabled: subscription.trialEnabled, trialStartsAt: subscription.trialStartsAt, trialEndsAt: subscription.trialEndsAt, contractedPrice: subscription.contractedPrice } });
        if (!existingSubscription && dto.trialEnabled === false) {
          const charge = await tx.subscriptionCharge.create({ data: { commercialAccountId: commercialAccount.id, subscriptionId: subscription.id, organizationId: organization.id, amount: version.price, dueDate: recifeMidnight(recifeCivilDate(new Date())), nature: 'FIRST_PAYMENT' }, select: { id: true, dueDate: true } });
          await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CHARGE_CREATED, targetType: AuditTargetType.SUBSCRIPTION_CHARGE, targetId: charge.id, commercialAccountId: commercialAccount.id, organizationId: organization.id, after: { nature: 'FIRST_PAYMENT', dueDate: charge.dueDate } });
        }
        return {
          organization: { ...organization, commercialAccount: { ...organization.commercialAccount, primaryContactUserId: admin.id } },
          commercialAccount: { ...commercialAccount, primaryContactOrganizationId: existingAccount?.primaryContactOrganizationId ?? organization.id, primaryContactUserId: existingAccount?.primaryContactUserId ?? admin.id },
          admin,
          subscription,
        };
      });
      return { ...result, activationToken };
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
    const projected = rows.map((row) => this.present(row));
    const filtered = projected.filter((row) =>
      (!dto.lifecycle?.length || dto.lifecycle.some((value) => row.lifecycle.includes(value))) &&
      (!dto.commercialAccess?.length || dto.commercialAccess.includes(row.commercialAccess as OrganizationCommercialAccessFilter)),
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

  private present(row: Prisma.OrganizationGetPayload<{ select: typeof organizationSelect }>, asOf = new Date()) {
    const account = row.commercialAccount;
    const subscription = account?.subscriptions[0];
    const contact = account?.primaryContact && account.primaryContact.role === 'ADMIN' && account.primaryContact.status === 'ACTIVE'
      ? account.primaryContact : null;
    const charges = subscription?.charges ?? [];
    const access = subscription ? deriveCommercialAccess(charges, asOf) : { commercialAccess: 'PAYMENT_BLOCKED' as const, delinquent: false, paymentGracePeriod: false };
    const conditions = subscription ? deriveSubscriptionConditions(subscription, asOf) : {
      pendingCommercialSetup: false, trial: false, awaitingFirstPayment: false, delinquent: false,
      paymentGracePeriod: false, scheduledCancellation: false, effectiveCancellation: false, commercialAccess: 'PAYMENT_BLOCKED' as const,
    };
    const openCharges = charges.filter((charge) => chargeBalance(charge).gt(0));
    const nextCharge = [...openCharges].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
    const blockDate = nextCharge ? recifeMidnight(addCivilDays(recifeCivilDate(nextCharge.dueDate), nextCharge.nature === 'RENEWAL' ? 6 : 1)) : null;
    const paidAmount = charges.reduce((sum, charge) => sum.add(charge.amount.sub(chargeBalance(charge))), new Prisma.Decimal(0));
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
      payment: { condition: access.delinquent ? 'OVERDUE' : outstandingAmount.isZero() ? 'PAID' : 'OPEN', paidAmount: paidAmount.toFixed(2), outstandingAmount: outstandingAmount.toFixed(2) },
      commercialAccess: access.commercialAccess,
      effectiveAccess: { allowed: row.operationalStatus === 'ACTIVE' && access.commercialAccess !== 'PAYMENT_BLOCKED', operationalStatus: row.operationalStatus, commercialAccess: access.commercialAccess },
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

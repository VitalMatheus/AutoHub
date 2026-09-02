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

const organizationSelect = { id: true, name: true, document: true, phone: true, email: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, operationalStatus: true, createdAt: true, updatedAt: true, commercialAccount: { select: { id: true, name: true, primaryContactUserId: true } } } as const;

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
        const commercialAccount = await tx.commercialAccount.create({ data: { name: dto.name.trim(), billingEmail: dto.email ? this.normalizeEmail(dto.email) : undefined, billingDocument: dto.document ? this.normalizeDocument(dto.document) : undefined } });
        const organization = await tx.organization.create({ data: {
          commercialAccountId: commercialAccount.id,
          name: dto.name.trim(), document: dto.document ? this.normalizeDocument(dto.document) : undefined, phone: dto.phone, email: dto.email ? this.normalizeEmail(dto.email) : undefined,
          addressLine1: dto.addressLine1, addressLine2: dto.addressLine2, city: dto.city, state: dto.state, postalCode: dto.postalCode,
        }, select: organizationSelect });
        const admin = await tx.user.create({ data: {
          organizationId: organization.id, name: adminName.trim(), email: this.normalizeEmail(adminEmail), role: 'ADMIN', status: 'PENDING_ACTIVATION',
        }, select: { id: true, name: true, email: true, role: true, status: true, organizationId: true } });
        await tx.actionToken.create({ data: { userId: admin.id, purpose: 'ACTIVATE_ACCOUNT', tokenHash: this.hashToken(activationToken), expiresAt: new Date(Date.now() + expiresDays * 86400000) } });
        await tx.commercialAccount.update({ where: { id: commercialAccount.id }, data: { primaryContactOrganizationId: organization.id, primaryContactUserId: admin.id } });
        const subscription = await tx.subscription.create({ data: {
          commercialAccountId: commercialAccount.id, planVersionId: version.id, status: 'SCHEDULED',
          contractedPrice: version.price, contractedCurrency: version.currency, contractedInterval: version.interval,
          contractedOrganizationLimit: version.organizationLimit, contractedUserLimit: version.userLimit,
          contractedWorkOrderLimit: version.workOrderLimit, contractedGracePeriodDays: version.gracePeriodDays,
          trialEnabled: dto.trialEnabled !== false, trialStartsAt: dto.trialEnabled !== false ? explicitTrialStart : null,
          trialEndsAt: dto.trialEnabled !== false ? trialEndsAt : null, commercialStartAt: dto.trialEnabled !== false ? explicitTrialStart : null,
        }, select: { id: true, planVersionId: true, status: true, trialEnabled: true, trialStartsAt: true, trialEndsAt: true, contractedPrice: true } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.COMMERCIAL_ACCOUNT_CREATED, targetType: AuditTargetType.COMMERCIAL_ACCOUNT, targetId: commercialAccount.id, commercialAccountId: commercialAccount.id, after: { name: commercialAccount.name, organizationId: organization.id, primaryContactId: admin.id } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.ORGANIZATION_CREATED, targetType: AuditTargetType.ORGANIZATION, targetId: organization.id, organizationId: organization.id, after: { name: organization.name, operationalStatus: organization.operationalStatus, initialAdminId: admin.id, initialAdminName: admin.name, initialAdminEmail: admin.email } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.USER_INVITATION_ISSUED, targetType: AuditTargetType.USER, targetId: admin.id, organizationId: organization.id, after: { name: admin.name, email: admin.email, role: admin.role, status: admin.status } });
        await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CREATED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscription.id, commercialAccountId: commercialAccount.id, after: { planVersionId: subscription.planVersionId, status: subscription.status, trialEnabled: subscription.trialEnabled, trialStartsAt: subscription.trialStartsAt, trialEndsAt: subscription.trialEndsAt, contractedPrice: subscription.contractedPrice } });
        if (dto.trialEnabled === false) {
          const charge = await tx.subscriptionCharge.create({ data: { commercialAccountId: commercialAccount.id, subscriptionId: subscription.id, organizationId: organization.id, amount: version.price, dueDate: recifeMidnight(recifeCivilDate(new Date())), nature: 'FIRST_PAYMENT' }, select: { id: true, dueDate: true } });
          await this.auditEvents.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CHARGE_CREATED, targetType: AuditTargetType.SUBSCRIPTION_CHARGE, targetId: charge.id, commercialAccountId: commercialAccount.id, organizationId: organization.id, after: { nature: 'FIRST_PAYMENT', dueDate: charge.dueDate } });
        }
        return {
          organization: { ...organization, commercialAccount: { ...organization.commercialAccount, primaryContactUserId: admin.id } },
          commercialAccount: { ...commercialAccount, primaryContactOrganizationId: organization.id, primaryContactUserId: admin.id },
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

  async list(page = 1, pageSize = 20) {
    const safePage = Math.max(1, page); const safeSize = Math.min(100, Math.max(1, pageSize));
    const [data, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({ select: organizationSelect, orderBy: { createdAt: 'desc' }, skip: (safePage - 1) * safeSize, take: safeSize }),
      this.prisma.organization.count(),
    ]);
    return { data, meta: { page: safePage, pageSize: safeSize, total, totalPages: Math.ceil(total / safeSize) } };
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id }, select: { ...organizationSelect, users: { where: { role: 'ADMIN' }, select: { id: true, name: true, email: true, status: true } } } });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
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

}

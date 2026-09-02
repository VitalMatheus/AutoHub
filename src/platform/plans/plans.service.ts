import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PlanVersionStatus } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreatePlanVersionDto } from './dto/create-plan-version.dto';
import { ListPlansDto } from './dto/list-plans.dto';

const versionSelect = { id: true, planId: true, version: true, status: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, workOrderLimit: true, gracePeriodDays: true, publishedAt: true, createdAt: true } as const;
function present<T extends { price: Prisma.Decimal }>(version: T): Omit<T, 'price'> & { price: string } { return { ...version, price: version.price.toFixed(2) }; }

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService, private readonly auditEvents: AuditEventsService) {}

  async list(dto: ListPlansDto) {
    const page = dto.page ?? 1; const pageSize = dto.pageSize ?? 20;
    const where: Prisma.PlanWhereInput = dto.search ? { name: { contains: dto.search.trim(), mode: 'insensitive' } } : {};
    const [plans, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({ where, include: { versions: { orderBy: { version: 'desc' }, select: versionSelect } }, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.plan.count({ where }),
    ]);
    return { data: plans.map((plan) => ({ ...plan, versions: plan.versions.map(present) })), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async detail(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id }, include: { versions: { orderBy: { version: 'desc' }, select: { ...versionSelect, _count: { select: { subscriptions: true } } } } } });
    if (!plan) throw new NotFoundException('Plan not found');
    return { ...plan, versions: plan.versions.map((v) => ({ ...present(v), used: v._count.subscriptions > 0 })) };
  }

  async create(principal: AuthenticatedPrincipal, dto: CreatePlanDto) {
    try { return await this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({ data: { name: dto.name.trim() }, include: { versions: true } });
      await this.auditEvents.record(tx, principal, { action: AuditAction.PLAN_CREATED, targetType: AuditTargetType.PLAN, targetId: plan.id, after: { name: plan.name, archivedAt: null } });
      return plan;
    }); } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Plan name already exists'); throw e; }
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: CreatePlanDto) {
    try { return await this.prisma.$transaction(async (tx) => {
      const before = await tx.plan.findUnique({ where: { id } }); if (!before) throw new NotFoundException('Plan not found');
      if (before.archivedAt) throw new ConflictException('Archived Plan cannot be edited');
      const plan = await tx.plan.update({ where: { id }, data: { name: dto.name.trim() } });
      await this.auditEvents.record(tx, principal, { action: AuditAction.PLAN_UPDATED, targetType: AuditTargetType.PLAN, targetId: id, before: { name: before.name }, after: { name: plan.name } }); return plan;
    }); } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Plan name already exists'); throw e; }
  }

  async createVersion(principal: AuthenticatedPrincipal, planId: string, dto: CreatePlanVersionDto) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({ where: { id: planId }, select: { id: true, archivedAt: true } }); if (!plan) throw new NotFoundException('Plan not found');
      if (plan.archivedAt) throw new ConflictException('Archived Plan cannot receive versions');
      const last = await tx.planVersion.findFirst({ where: { planId }, orderBy: { version: 'desc' }, select: { version: true } });
      const version = await tx.planVersion.create({ data: { planId, version: (last?.version ?? 0) + 1, price: dto.price, currency: dto.currency, interval: dto.interval, organizationLimit: dto.organizationLimit, userLimit: dto.userLimit, workOrderLimit: dto.workOrderLimit ?? null, gracePeriodDays: dto.gracePeriodDays }, select: versionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.PLAN_VERSION_CREATED, targetType: AuditTargetType.PLAN_VERSION, targetId: version.id, after: present(version) }); return present(version);
    });
  }

  async updateVersion(principal: AuthenticatedPrincipal, id: string, dto: CreatePlanVersionDto) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.planVersion.findUnique({ where: { id }, select: versionSelect }); if (!before) throw new NotFoundException('Plan Version not found');
      if (before.status !== PlanVersionStatus.DRAFT) throw new ConflictException('Published Plan Version is immutable');
      const version = await tx.planVersion.update({ where: { id }, data: { price: dto.price, currency: dto.currency, interval: dto.interval, organizationLimit: dto.organizationLimit, userLimit: dto.userLimit, workOrderLimit: dto.workOrderLimit ?? null, gracePeriodDays: dto.gracePeriodDays }, select: versionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.PLAN_VERSION_UPDATED, targetType: AuditTargetType.PLAN_VERSION, targetId: id, before: present(before), after: present(version) }); return present(version);
    });
  }

  async publish(principal: AuthenticatedPrincipal, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.planVersion.findUnique({ where: { id }, select: { ...versionSelect, plan: { select: { archivedAt: true } } } }); if (!before) throw new NotFoundException('Plan Version not found');
      if (before.plan.archivedAt) throw new ConflictException('Archived Plan cannot be published');
      if (before.status !== PlanVersionStatus.DRAFT) throw new ConflictException('Plan Version is already published');
      const version = await tx.planVersion.update({ where: { id }, data: { status: PlanVersionStatus.PUBLISHED, publishedAt: new Date() }, select: versionSelect });
      await this.auditEvents.record(tx, principal, { action: AuditAction.PLAN_VERSION_PUBLISHED, targetType: AuditTargetType.PLAN_VERSION, targetId: id, after: present(version) }); return present(version);
    });
  }

  async deleteVersion(principal: AuthenticatedPrincipal, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.planVersion.findUnique({ where: { id }, select: { id: true, status: true, _count: { select: { subscriptions: true } } } }); if (!version) throw new NotFoundException('Plan Version not found');
      if (version.status !== PlanVersionStatus.DRAFT || version._count.subscriptions > 0) throw new ConflictException('Published or used Plan Version cannot be deleted');
      await tx.planVersion.delete({ where: { id } }); return { deleted: true };
    });
  }

  async archive(principal: AuthenticatedPrincipal, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({ where: { id }, include: { versions: { where: { status: PlanVersionStatus.PUBLISHED }, select: { id: true } } } }); if (!plan) throw new NotFoundException('Plan not found');
      if (plan.archivedAt) throw new ConflictException('Plan is already archived');
      const available = await tx.plan.count({ where: { archivedAt: null, versions: { some: { status: PlanVersionStatus.PUBLISHED } } } });
      if (plan.versions.length > 0 && available <= 1) throw new ConflictException('The only Plan available for new contracts cannot be archived');
      const archived = await tx.plan.update({ where: { id }, data: { archivedAt: new Date() } });
      await this.auditEvents.record(tx, principal, { action: AuditAction.PLAN_ARCHIVED, targetType: AuditTargetType.PLAN, targetId: id, before: { archivedAt: null }, after: { archivedAt: archived.archivedAt } }); return archived;
    });
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, AuditActorType } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, AuditTargetType, ListAuditEventsDto } from './dto/list-audit-events.dto';

export type AuditEventInput = {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  organizationId?: string;
  commercialAccountId?: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

const eventSelect = {
  id: true, actorType: true, actorUserId: true, actorName: true, actorEmail: true,
  occurredAt: true, action: true, targetType: true, targetId: true,
  commercialAccountId: true, organizationId: true, reason: true, before: true, after: true,
} as const;

@Injectable()
export class AuditEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Prisma.TransactionClient, principal: AuthenticatedPrincipal | null, input: AuditEventInput) {
    const actor = principal
      ? { actorType: AuditActorType.USER, actorUserId: principal.id, actorName: principal.name, actorEmail: principal.email }
      : { actorType: AuditActorType.SYSTEM, actorName: null, actorEmail: null };
    return tx.auditEvent.create({
      data: {
        ...actor, action: input.action, targetType: input.targetType, targetId: input.targetId,
        organizationId: input.organizationId, commercialAccountId: input.commercialAccountId,
        reason: input.reason, before: this.snapshot(input.targetType, input.before), after: this.snapshot(input.targetType, input.after),
      }, select: eventSelect,
    });
  }

  private snapshot(targetType: string, value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
    if (!value) return undefined;
    const fields: Record<string, string[]> = {
      ORGANIZATION: ['name', 'document', 'phone', 'email', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'operationalStatus', 'initialAdminId', 'initialAdminName', 'initialAdminEmail'],
      USER: ['id', 'name', 'email', 'role', 'status'], COMMERCIAL_ACCOUNT: ['name', 'billingEmail', 'billingDocument', 'primaryContactId'],
      PLAN: ['name', 'archivedAt'], PLAN_VERSION: ['price', 'currency', 'interval', 'organizationLimit', 'userLimit', 'workOrderLimit', 'gracePeriodDays'],
      SUBSCRIPTION: ['planVersionId', 'contractedPrice', 'contractedCurrency', 'contractedInterval', 'contractedOrganizationLimit', 'contractedUserLimit', 'contractedWorkOrderLimit', 'contractedGracePeriodDays', 'status', 'migratedAt', 'regularizedAt', 'commercialStartAt', 'firstDueDate', 'billingDay', 'firstPaymentReceivedAt', 'firstPaidPeriodStartedAt', 'trialEnabled', 'trialStartsAt', 'trialEndsAt', 'currentPeriodStart', 'currentPeriodEnd', 'cancellationRequestedAt', 'effectiveCancellationAt', 'scheduledPlanVersionId', 'scheduledPlanEffectiveAt', 'scheduledPlanReason', 'scheduledRecurringAdjustment', 'scheduledAdjustmentEffectiveAt', 'scheduledAdjustmentReason', 'cardRenewalAuthorized', 'cardRenewalAuthorizedAt', 'cardRenewalRevokedAt', 'providerCustomerRef', 'providerPaymentMethodRef'],
      SUBSCRIPTION_CHARGE: ['amount', 'dueDate', 'nature', 'billingPeriodStart', 'billingPeriodEnd', 'cancelledAt'],
      CHARGE_SETTLEMENT: ['amount', 'receivedAt', 'effectiveAt', 'reason', 'origin', 'method'],
    };
    return Object.fromEntries((fields[targetType] ?? []).filter((key) => key in value).map((key) => [key, value[key]])) as Prisma.InputJsonObject;
  }

  async list(dto: ListAuditEventsDto) {
    const limit = dto.pageSize ?? 20;
    const cursor = dto.cursor ? this.decodeCursor(dto.cursor) : undefined;
    const where: Prisma.AuditEventWhereInput = {
      ...(dto.from || dto.to ? { occurredAt: { ...(dto.from ? { gte: new Date(dto.from) } : {}), ...(dto.to ? { lt: new Date(dto.to) } : {}) } } : {}),
      ...(dto.actor ? (dto.actor === 'SYSTEM' ? { actorType: AuditActorType.SYSTEM } : { actorUserId: dto.actor }) : {}), ...(dto.action ? { action: dto.action } : {}),
      ...(dto.targetType ? { targetType: dto.targetType } : {}), ...(dto.target ? { targetId: dto.target } : {}),
      ...(cursor ? { OR: [{ occurredAt: { lt: cursor.occurredAt } }, { occurredAt: cursor.occurredAt, id: { lt: cursor.id } }] } : {}),
    };
    const rows = await this.prisma.auditEvent.findMany({ where, select: eventSelect, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    return { data: data.map((event) => ({
      id: event.id, occurredAt: event.occurredAt,
      actor: { type: event.actorType, userId: event.actorUserId, name: event.actorName, email: event.actorEmail },
      action: event.action, target: { type: event.targetType, id: event.targetId },
      commercialAccountId: event.commercialAccountId, organizationId: event.organizationId, reason: event.reason,
      changes: { before: event.before, after: event.after },
    })), meta: { pageSize: limit, hasNextPage: hasMore, nextCursor: hasMore && last ? this.encodeCursor(last.occurredAt, last.id) : null } };
  }

  private encodeCursor(occurredAt: Date, id: string) { return Buffer.from(JSON.stringify({ occurredAt: occurredAt.toISOString(), id })).toString('base64url'); }

  private decodeCursor(value: string): { occurredAt: Date; id: string } {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { occurredAt?: string; id?: string };
      const occurredAt = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date('invalid');
      if (!parsed.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id) || Number.isNaN(occurredAt.getTime())) throw new Error();
      return { occurredAt, id: parsed.id };
    } catch { throw new BadRequestException('Invalid audit events cursor'); }
  }
}

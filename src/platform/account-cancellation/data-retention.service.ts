import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';
import { retentionDeadline } from '../subscriptions/subscriptions.service';

/**
 * Applies the approved 90-day exit policy. This is intentionally an explicit
 * command seam: deployment infrastructure decides when to invoke it, while
 * the transaction remains idempotent and tenant-scoped.
 */
@Injectable()
export class DataRetentionService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditEventsService) {}

  async finalizeDue(asOf = new Date()) {
    const candidates = await this.prisma.subscription.findMany({
      where: { effectiveCancellationAt: { not: null }, dataFinalizedAt: null, commercialAccount: { organizations: { some: {} } } },
      select: { id: true, commercialAccountId: true, effectiveCancellationAt: true, dataRetentionEndsAt: true, commercialAccount: { select: { organizations: { select: { id: true } } } } },
    });
    let finalized = 0;
    for (const subscription of candidates) {
      const deadline = subscription.dataRetentionEndsAt ?? retentionDeadline(subscription.effectiveCancellationAt!);
      if (deadline > asOf) continue;
      for (const organization of subscription.commercialAccount?.organizations ?? []) {
        if (await this.finalizeOrganization(subscription.id, organization.id, subscription.commercialAccountId!, deadline, asOf)) finalized++;
      }
    }
    return { finalized };
  }

  async finalizeOrganization(subscriptionId: string, organizationId: string, commercialAccountId: string, deadline: Date, asOf = new Date()) {
    if (deadline > asOf) return false;
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findFirst({ where: { id: subscriptionId, commercialAccountId, dataFinalizedAt: null, effectiveCancellationAt: { not: null } }, select: { id: true, dataFinalizedAt: true } });
      if (!subscription) return false;
      const users = await tx.user.findMany({ where: { organizationId }, select: { id: true } });
      const userIds = users.map((user) => user.id);
      if (userIds.length) {
        await tx.session.updateMany({ where: { userId: { in: userIds }, revokedAt: null }, data: { revokedAt: asOf } });
        await tx.actionToken.updateMany({ where: { userId: { in: userIds }, usedAt: null }, data: { usedAt: asOf } });
        await tx.user.updateMany({ where: { organizationId }, data: { name: 'Usuário retido', passwordHash: null, status: 'DISABLED' } });
        const retainedUsers = await tx.user.findMany({ where: { organizationId }, select: { id: true } });
        for (const user of retainedUsers) {
          await tx.user.update({ where: { id: user.id }, data: { email: `retido+${user.id}@invalid.local` } });
        }
      }

      await tx.commercialAccount.update({ where: { id: commercialAccountId }, data: { name: `Conta retida ${commercialAccountId.slice(0, 8)}`, billingEmail: null, billingDocument: null, primaryContactOrganizationId: null, primaryContactUserId: null } });
      await tx.organization.update({ where: { id: organizationId }, data: { name: `Organization retida ${organizationId.slice(0, 8)}`, document: null, phone: null, email: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, notes: null, operationalStatus: 'INACTIVE' } });
      await tx.customer.updateMany({ where: { organizationId }, data: { name: 'Cliente retido', document: null, phone: '00000000000', email: null, notes: null, active: false } });
      await tx.supplier.updateMany({ where: { organizationId }, data: { name: 'Fornecedor retido', document: null, email: null, phone: null, notes: null, active: false } });
      await tx.service.updateMany({ where: { organizationId }, data: { name: 'Serviço retido', description: null, active: false } });
      await tx.product.updateMany({ where: { organizationId }, data: { name: 'Produto retido', description: null, active: false, stockQuantity: 0 } });
      const vehicles = await tx.vehicle.findMany({ where: { organizationId }, select: { id: true } });
      for (const vehicle of vehicles) await tx.vehicle.update({ where: { id: vehicle.id }, data: { plate: `RET-${vehicle.id.slice(0, 8)}`, brand: 'Retido', model: 'Retido', color: null, mileage: null, notes: null, active: false } });
      await tx.quote.updateMany({ where: { organizationId }, data: { notes: null } });
      await tx.workOrder.updateMany({ where: { organizationId }, data: { reportedProblem: null, diagnosis: null, notes: null } });
      await tx.subscription.update({ where: { id: subscriptionId }, data: { status: 'ENDED', dataRetentionEndsAt: deadline, dataFinalizedAt: asOf } });
      await this.audit.record(tx, null, { action: AuditAction.SUBSCRIPTION_DATA_FINALIZED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscriptionId, commercialAccountId, organizationId, after: { dataFinalizedAt: asOf, retainedEvidence: 'TRIAL_ELIGIBILITY_PSEUDONYMOUS_ONLY' } });
      return true;
    });
  }
}

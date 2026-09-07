import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { AuthService } from '../../auth/auth.service';
import { TransactionalEmailService } from '../../common/transactional-email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { addAnchoredCivilMonths, addCivilDays, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';
import { retentionDeadline } from '../subscriptions/subscriptions.service';

const TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AccountCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly email: TransactionalEmailService,
    private readonly config: ConfigService,
    private readonly audit: AuditEventsService,
  ) {}

  async request(principal: AuthenticatedPrincipal, password: string) {
    await this.auth.verifyCurrentPassword(principal, password);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const result = await this.prisma.$transaction(async (tx) => {
      const account = await this.primaryAccount(tx, principal);
      const subscription = await tx.subscription.findFirst({
        where: { commercialAccountId: account.commercialAccountId, status: { not: 'ENDED' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, commercialAccountId: true, effectiveCancellationAt: true },
      });
      if (!subscription) throw new NotFoundException('Subscription not found');
      if (subscription.effectiveCancellationAt) throw new ConflictException('Subscription is already scheduled for cancellation');

      await tx.actionToken.updateMany({ where: { userId: principal.id, purpose: 'CONFIRM_SUBSCRIPTION_CANCELLATION', usedAt: null }, data: { expiresAt: new Date() } });
      await tx.actionToken.create({ data: { userId: principal.id, purpose: 'CONFIRM_SUBSCRIPTION_CANCELLATION', targetSubscriptionId: subscription.id, tokenHash: this.hash(token), expiresAt } });
      await this.audit.record(tx, principal, {
        action: AuditAction.SUBSCRIPTION_CANCELLATION_CONFIRMATION_REQUESTED,
        targetType: AuditTargetType.SUBSCRIPTION,
        targetId: subscription.id,
        commercialAccountId: account.commercialAccountId,
        organizationId: principal.organizationId!,
        after: { confirmationRequired: true, expiresAt },
      });
      return { email: account.primaryContactEmail, subscriptionId: subscription.id };
    });

    try {
      const link = `${this.config.getOrThrow<string>('PUBLIC_APP_URL')}/cancelar-assinatura?token=${encodeURIComponent(token)}`;
      await this.email.send({
        to: result.email,
        subject: 'Confirme o cancelamento da sua conta Vekar',
        text: `Recebemos uma solicitação de cancelamento. Confirme pelo link: ${link}\n\nNenhuma cobrança foi cancelada por esta solicitação.`,
      });
    } catch {
      // The token remains valid and can be resent by the caller. Do not expose delivery details.
    }
    return { message: 'Enviamos uma confirmação de cancelamento para o e-mail do administrador principal.' };
  }

  async confirm(token: string) {
    const now = new Date();
    const tokenHash = this.hash(token);
    return this.prisma.$transaction(async (tx) => {
      const action = await tx.actionToken.findFirst({
        where: { tokenHash, purpose: 'CONFIRM_SUBSCRIPTION_CANCELLATION', usedAt: null, expiresAt: { gt: now }, targetSubscriptionId: { not: null } },
        select: { id: true, userId: true, targetSubscriptionId: true, user: { select: { id: true, organizationId: true, role: true, status: true, email: true, organization: { select: { id: true, commercialAccountId: true } } } } },
      });
      if (!action?.targetSubscriptionId || action.user.role !== 'ADMIN' || action.user.status !== 'ACTIVE' || !action.user.organizationId || !action.user.organization?.commercialAccountId) {
        throw new UnauthorizedException('Cancellation token is invalid or expired');
      }
      const account = await tx.commercialAccount.findFirst({ where: { id: action.user.organization.commercialAccountId, primaryContactOrganizationId: action.user.organizationId, primaryContactUserId: action.user.id }, select: { id: true } });
      if (!account) throw new UnauthorizedException('Cancellation token is invalid or expired');
      const claimed = await tx.actionToken.updateMany({ where: { id: action.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (claimed.count !== 1) throw new UnauthorizedException('Cancellation token is invalid or expired');

      const subscription = await tx.subscription.findFirst({
        where: { id: action.targetSubscriptionId, commercialAccountId: account.id, status: { not: 'ENDED' } },
        select: { id: true, commercialAccountId: true, status: true, currentPeriodEnd: true, trialEndsAt: true, firstPaidPeriodStartedAt: true, cancellationRequestedAt: true, effectiveCancellationAt: true },
      });
      if (!subscription) throw new ConflictException('Subscription is no longer cancellable');
      if (subscription.effectiveCancellationAt) return { success: true, effectiveCancellationAt: subscription.effectiveCancellationAt.toISOString(), dataRetentionEndsAt: retentionDeadline(subscription.effectiveCancellationAt), exportPath: '/api/v1/exports/customers.csv' };

      const effectiveAt = subscription.currentPeriodEnd
        ?? subscription.trialEndsAt
        ?? (subscription.firstPaidPeriodStartedAt ? recifeMidnight(addAnchoredCivilMonths(recifeCivilDate(subscription.firstPaidPeriodStartedAt), 1)) : null);
      if (!effectiveAt || effectiveAt <= now) throw new ConflictException('Subscription has no future paid-through date');
      const dataRetentionEndsAt = retentionDeadline(effectiveAt);
      const updated = await tx.subscription.update({ where: { id: subscription.id }, data: { cancellationRequestedAt: now, effectiveCancellationAt: effectiveAt, dataRetentionEndsAt, dataFinalizedAt: null }, select: { effectiveCancellationAt: true, dataRetentionEndsAt: true } });
      await this.audit.record(tx, { id: action.user.id, name: 'Primary Admin', email: action.user.email, role: 'ADMIN', organizationId: action.user.organizationId }, {
        action: AuditAction.SUBSCRIPTION_CANCELLATION_CONFIRMED,
        targetType: AuditTargetType.SUBSCRIPTION,
        targetId: subscription.id,
        commercialAccountId: account.id,
        organizationId: action.user.organizationId,
        after: { effectiveCancellationAt: updated.effectiveCancellationAt, dataRetentionEndsAt: updated.dataRetentionEndsAt },
      });
      await this.audit.record(tx, { id: action.user.id, name: 'Primary Admin', email: action.user.email, role: 'ADMIN', organizationId: action.user.organizationId }, {
        action: AuditAction.SUBSCRIPTION_CANCELLATION_REQUESTED,
        targetType: AuditTargetType.SUBSCRIPTION,
        targetId: subscription.id,
        commercialAccountId: account.id,
        organizationId: action.user.organizationId,
        reason: 'Self-service cancellation confirmed by e-mail',
        after: { effectiveCancellationAt: updated.effectiveCancellationAt, dataRetentionEndsAt: updated.dataRetentionEndsAt },
      });
      return { success: true, effectiveCancellationAt: updated.effectiveCancellationAt!.toISOString(), dataRetentionEndsAt: updated.dataRetentionEndsAt!.toISOString(), exportPath: '/api/v1/exports/customers.csv' };
    });
  }

  private async primaryAccount(tx: Prisma.TransactionClient, principal: AuthenticatedPrincipal) {
    const account = await tx.commercialAccount.findFirst({
      where: { organizations: { some: { id: principal.organizationId! } }, primaryContactOrganizationId: principal.organizationId, primaryContactUserId: principal.id },
      select: { id: true, primaryContact: { select: { email: true } } },
    });
    if (!account?.primaryContact?.email) throw new ForbiddenException('Only the primary Organization Admin can cancel the Subscription');
    return { commercialAccountId: account.id, primaryContactEmail: account.primaryContact.email };
  }

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
}

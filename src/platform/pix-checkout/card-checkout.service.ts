import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardAttemptKind, CardAttemptStatus, ChargeSettlementKind, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { PrismaService } from '../../prisma/prisma.service';
import { addCivilMonths, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';
import { chargeBalance } from '../billing/commercial-access';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';
import { AsaasPaymentProvider, CardPaymentProvider, VerifiedPayment } from '../../payments/asaas-payment.provider';
import { AsaasWebhookDto } from '../../payments/dto/asaas-webhook.dto';
import { CardCheckoutResponseDto, ConfirmCardCheckoutDto } from '../../payments/dto/card-checkout.dto';

const BASIC = 'BASIC';
const PRICE = new Prisma.Decimal('79.00');

type AttemptRow = {
  id: string;
  kind: CardAttemptKind;
  status: CardAttemptStatus;
  amount: Prisma.Decimal;
  currency: string;
  checkoutUrl: string | null;
  expiresAt: Date | null;
  authorizeRenewal: boolean;
  failureReason: string | null;
};

function present(attempt: AttemptRow): CardCheckoutResponseDto {
  return {
    attemptId: attempt.id,
    kind: attempt.kind,
    status: attempt.status,
    amount: attempt.amount.toFixed(2),
    currency: attempt.currency,
    checkoutUrl: attempt.checkoutUrl,
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    renewalAuthorized: attempt.authorizeRenewal,
    failureReason: attempt.failureReason,
  };
}

@Injectable()
export class CardCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly provider: AsaasPaymentProvider,
    private readonly audit: AuditEventsService,
  ) {}

  private requireAdmin(principal: AuthenticatedPrincipal) {
    if (principal.role !== 'ADMIN' || !principal.organizationId) throw new ForbiddenException('Organization Admin access required');
    return principal.organizationId;
  }

  private planWhere() {
    return { plan: { code: BASIC, archivedAt: null }, status: 'PUBLISHED' as const };
  }

  private attemptSelect = {
    id: true, kind: true, status: true, amount: true, currency: true, checkoutUrl: true,
    expiresAt: true, authorizeRenewal: true, failureReason: true,
  } as const;

  async createHostedCheckout(principal: AuthenticatedPrincipal, dto: ConfirmCardCheckoutDto) {
    const organizationId = this.requireAdmin(principal);
    if (dto.confirmed !== true) throw new BadRequestException('Basic Plan conditions must be explicitly confirmed');
    const created = await this.prepareAttempt(organizationId, CardAttemptKind.INITIAL, dto.authorizeRenewal === true);
    if ('existing' in created) return present(created.existing!);
    const attempt = created.attempt!;

    try {
      const hosted = await this.provider.createHostedCardCheckout({
        amount: attempt.amount.toFixed(2), currency: attempt.currency,
        reference: attempt.id, idempotencyKey: created.idempotencyKey,
        authorizeRenewal: attempt.authorizeRenewal,
      });
      const updated = await this.prisma.cardPaymentAttempt.update({ where: { id: created.attempt.id }, data: {
        externalId: hosted.externalId, checkoutUrl: hosted.checkoutUrl, expiresAt: hosted.expiresAt,
        providerCustomerRef: hosted.customerReference, providerPaymentMethodRef: hosted.paymentMethodReference,
      }, select: this.attemptSelect });
      return present(updated);
    } catch {
      const failed = await this.prisma.cardPaymentAttempt.update({ where: { id: attempt.id }, data: { status: CardAttemptStatus.FAILED, failureReason: 'Provider unavailable' }, select: this.attemptSelect });
      return present(failed);
    }
  }

  async renew(principal: AuthenticatedPrincipal) {
    const organizationId = this.requireAdmin(principal);
    const created = await this.prepareAttempt(organizationId, CardAttemptKind.RENEWAL, true);
    if ('existing' in created) return present(created.existing!);
    const attempt = created.attempt!;
    if (!created.customerReference || !created.paymentMethodReference) throw new ConflictException('Card renewal authorization is incomplete');

    try {
      const payment = await this.provider.createAuthorizedRenewal({
        amount: attempt.amount.toFixed(2), currency: attempt.currency,
        reference: attempt.id, idempotencyKey: created.idempotencyKey,
        customerReference: created.customerReference, paymentMethodReference: created.paymentMethodReference,
      });
      const updated = await this.prisma.cardPaymentAttempt.update({ where: { id: created.attempt.id }, data: { externalId: payment.externalId, expiresAt: payment.expiresAt }, select: this.attemptSelect });
      return present(updated);
    } catch {
      const failed = await this.prisma.cardPaymentAttempt.update({ where: { id: attempt.id }, data: { status: CardAttemptStatus.FAILED, failureReason: 'Provider unavailable' }, select: this.attemptSelect });
      return present(failed);
    }
  }

  async revokeRenewal(principal: AuthenticatedPrincipal) {
    const organizationId = this.requireAdmin(principal);
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, commercialAccountId: true } });
      if (!organization?.commercialAccountId) throw new NotFoundException('Subscription not found');
      const subscription = await tx.subscription.findFirst({ where: { commercialAccountId: organization.commercialAccountId, status: { not: 'ENDED' } }, orderBy: { createdAt: 'desc' } });
      if (!subscription) throw new NotFoundException('Subscription not found');
      const updated = await tx.subscription.update({ where: { id: subscription.id }, data: { cardRenewalAuthorized: false, cardRenewalRevokedAt: new Date() } });
      await this.audit.record(tx, principal, { action: AuditAction.SUBSCRIPTION_CARD_RENEWAL_REVOKED, targetType: AuditTargetType.SUBSCRIPTION, targetId: subscription.id, commercialAccountId: organization.commercialAccountId, after: { cardRenewalAuthorized: false, cardRenewalRevokedAt: updated.cardRenewalRevokedAt } });
      return { renewalAuthorized: false };
    });
  }

  async webhook(signature: string | undefined, dto: AsaasWebhookDto) {
    this.verifySignature(signature, dto);
    const existingEvent = await this.prisma.asaasWebhookEvent.findUnique({ where: { eventId: dto.id }, select: { id: true } });
    if (existingEvent) return { accepted: true, duplicate: true, settled: false };
    const candidate = await this.prisma.cardPaymentAttempt.findUnique({ where: { externalId: dto.payment.id }, select: { id: true } });
    if (!candidate) return null;
    const verified = await this.provider.verifyPayment(dto.payment.id);
    if (verified.externalId !== dto.payment.id) throw new UnauthorizedException('Invalid provider response');
    return this.applyWebhook(dto, verified);
  }

  private async applyWebhook(dto: AsaasWebhookDto, verified: VerifiedPayment) {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.cardPaymentAttempt.findUnique({ where: { externalId: verified.externalId }, include: { charge: { include: { settlements: { select: { id: true, originalSettlementId: true, amount: true, kind: true } } } } } });
      if (!attempt) throw new NotFoundException('Payment attempt not found');
      const amount = new Prisma.Decimal(String(verified.amount));
      if (!amount.eq(attempt.amount) || verified.currency !== attempt.currency || verified.reference !== attempt.id) throw new ConflictException('Provider payment does not match the open Charge');
      await tx.asaasWebhookEvent.create({ data: { eventId: dto.id, cardAttemptId: attempt.id, eventType: dto.event, payload: dto as unknown as Prisma.InputJsonValue } });

      if (verified.status === 'PENDING') return { accepted: true, settled: false };
      if (verified.status === 'FAILED' || verified.status === 'EXPIRED') {
        await tx.cardPaymentAttempt.update({ where: { id: attempt.id }, data: { status: verified.status } });
        await tx.asaasWebhookEvent.update({ where: { eventId: dto.id }, data: { processedAt: new Date() } });
        return { accepted: true, settled: false, status: verified.status };
      }
      if (verified.status === 'REFUNDED' || verified.status === 'CHARGEBACK') {
        const receipt = attempt.charge.settlements.find((item) => item.kind === ChargeSettlementKind.RECEIPT);
        if (receipt && !attempt.charge.settlements.some((item) => item.kind === ChargeSettlementKind.REVERSAL && item.originalSettlementId === receipt.id)) {
          await tx.chargeSettlement.create({ data: { chargeId: attempt.chargeId, originalSettlementId: receipt.id, kind: 'REVERSAL', origin: 'GATEWAY', amount: receipt.amount.neg(), receivedAt: new Date(), effectiveAt: new Date(), provider: 'ASAAS', externalId: `${verified.externalId}:${dto.event.toLowerCase()}` } });
        }
        await tx.cardPaymentAttempt.update({ where: { id: attempt.id }, data: { status: CardAttemptStatus.REVERSED } });
        await tx.asaasWebhookEvent.update({ where: { eventId: dto.id }, data: { processedAt: new Date() } });
        return { accepted: true, settled: false, reversed: true };
      }

      if (!attempt.charge.settlements.some((item) => item.kind === ChargeSettlementKind.RECEIPT && item.amount.eq(attempt.amount))) {
        await tx.chargeSettlement.create({ data: { chargeId: attempt.chargeId, kind: 'RECEIPT', origin: 'GATEWAY', amount: attempt.amount, receivedAt: new Date(), provider: 'ASAAS', externalId: verified.externalId } });
        if (attempt.kind === CardAttemptKind.INITIAL) {
          const paidStart = recifeCivilDate(new Date());
          await tx.subscription.update({ where: { id: attempt.subscriptionId }, data: { status: 'CURRENT', firstPaymentReceivedAt: new Date(), firstPaidPeriodStartedAt: recifeMidnight(paidStart), currentPeriodStart: recifeMidnight(paidStart), currentPeriodEnd: recifeMidnight(addCivilMonths(paidStart, 1)), ...(attempt.authorizeRenewal ? { cardRenewalAuthorized: true, cardRenewalAuthorizedAt: new Date(), providerCustomerRef: verified.customerReference, providerPaymentMethodRef: verified.paymentMethodReference } : {}) } });
        }
      }
      await tx.cardPaymentAttempt.update({ where: { id: attempt.id }, data: { status: CardAttemptStatus.PAID, providerCustomerRef: verified.customerReference, providerPaymentMethodRef: verified.paymentMethodReference } });
      await tx.asaasWebhookEvent.update({ where: { eventId: dto.id }, data: { processedAt: new Date() } });
      return { accepted: true, settled: true };
    });
  }

  private async prepareAttempt(organizationId: string, kind: CardAttemptKind, authorizeRenewal: boolean) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`;
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, commercialAccountId: true } });
      if (!organization?.commercialAccountId) throw new NotFoundException('Checkout not found');
      const version = await tx.planVersion.findFirst({ where: this.planWhere(), orderBy: [{ publishedAt: 'desc' }, { version: 'desc' }], select: { id: true, price: true, currency: true, interval: true, plan: { select: { name: true } } } });
      if (!version || !version.price.eq(PRICE) || version.currency !== 'BRL') throw new ConflictException('Basic Plan is unavailable');
      let subscription = await tx.subscription.findFirst({ where: { commercialAccountId: organization.commercialAccountId, status: { not: 'ENDED' } }, orderBy: { createdAt: 'desc' } });
      if (!subscription) subscription = await tx.subscription.create({ data: { commercialAccountId: organization.commercialAccountId, planVersionId: version.id, contractedPrice: version.price, contractedCurrency: version.currency, contractedInterval: version.interval, contractedOrganizationLimit: 1, contractedUserLimit: 3, contractedGracePeriodDays: 5, status: 'SCHEDULED', trialEnabled: false } });
      if (kind === CardAttemptKind.RENEWAL && (!subscription.cardRenewalAuthorized || subscription.cardRenewalRevokedAt)) throw new ConflictException('Card renewal is not authorized');
      const charges = await tx.subscriptionCharge.findMany({ where: { subscriptionId: subscription.id, cancelledAt: null, nature: { in: ['FIRST_PAYMENT', 'RENEWAL'] } }, orderBy: { createdAt: 'desc' }, include: { settlements: { select: { amount: true } } } });
      let charge = charges.find((candidate) => chargeBalance(candidate).gt(0));
      if (!charge && kind === CardAttemptKind.INITIAL) charge = await tx.subscriptionCharge.create({ data: { commercialAccountId: organization.commercialAccountId, subscriptionId: subscription.id, organizationId, amount: version.price, dueDate: recifeMidnight(recifeCivilDate(now)), nature: 'FIRST_PAYMENT', billingPeriodStart: recifeMidnight(recifeCivilDate(now)), billingPeriodEnd: recifeMidnight(addCivilMonths(recifeCivilDate(now), 1)) }, include: { settlements: { select: { amount: true } } } });
      if (!charge) throw new ConflictException('No open Subscription Charge is available for renewal');
      const existing = await tx.cardPaymentAttempt.findFirst({ where: { chargeId: charge.id, kind, status: { in: ['PROCESSING', 'PAID'] } }, orderBy: { createdAt: 'desc' }, select: this.attemptSelect });
      if (existing && (!existing.expiresAt || existing.expiresAt > now || existing.status === 'PAID')) return { existing };
      if (existing) await tx.cardPaymentAttempt.update({ where: { id: existing.id }, data: { status: CardAttemptStatus.EXPIRED } });
      const idempotencyKey = `card_${kind.toLowerCase()}_${charge.id}_${now.getTime()}`;
      const attempt = await tx.cardPaymentAttempt.create({ data: { organizationId, commercialAccountId: organization.commercialAccountId, subscriptionId: subscription.id, chargeId: charge.id, planVersionId: version.id, kind, idempotencyKey, amount: chargeBalance(charge), currency: version.currency, planNameSnapshot: version.plan.name, planPriceSnapshot: version.price, planIntervalSnapshot: version.interval, billingDay: Math.min(Number(recifeCivilDate(now).slice(-2)), 28), authorizeRenewal } , select: this.attemptSelect });
      return { attempt, idempotencyKey, customerReference: subscription.providerCustomerRef, paymentMethodReference: subscription.providerPaymentMethodRef };
    });
  }

  private verifySignature(signature: string | undefined, payload: unknown) {
    const secret = this.config.get<string>('ASAAS_WEBHOOK_SECRET');
    if (!secret || !signature) throw new UnauthorizedException('Invalid webhook signature');
    const expected = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    const a = Buffer.from(signature); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Invalid webhook signature');
  }
}

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChargeSettlementKind, Prisma, PixAttemptStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { PrismaService } from '../../prisma/prisma.service';
import { addCivilMonths, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';
import { chargeBalance } from '../billing/commercial-access';
import { AsaasPaymentProvider, PixPaymentProvider } from '../../payments/asaas-payment.provider';
import { ConfirmPixCheckoutDto } from '../../payments/dto/pix-checkout.dto';
import { AsaasWebhookDto } from '../../payments/dto/asaas-webhook.dto';

const BASIC = 'BASIC';
const PRICE = new Prisma.Decimal('79.00');

function present(attempt: any) {
  return {
    attemptId: attempt.id,
    status: attempt.status,
    amount: attempt.amount.toFixed(2),
    currency: attempt.currency,
    planName: attempt.planNameSnapshot,
    planPrice: attempt.planPriceSnapshot.toFixed(2),
    interval: attempt.planIntervalSnapshot,
    billingDay: attempt.billingDay,
    qrCode: attempt.qrCode ?? null,
    copyPasteCode: attempt.copyPasteCode ?? null,
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    failureReason: attempt.failureReason ?? null,
  };
}

@Injectable()
export class PixCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly provider: AsaasPaymentProvider,
  ) {}

  private requireAdmin(principal: AuthenticatedPrincipal) {
    if (principal.role !== 'ADMIN' || !principal.organizationId) throw new ForbiddenException('Organization Admin access required');
    return principal.organizationId;
  }

  private planWhere() {
    return { plan: { code: BASIC, archivedAt: null }, status: 'PUBLISHED' as const };
  }

  async checkout(principal: AuthenticatedPrincipal) {
    const organizationId = this.requireAdmin(principal);
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, commercialAccountId: true } });
    if (!organization?.commercialAccountId) throw new NotFoundException('Checkout not found');
    const version = await this.prisma.planVersion.findFirst({ where: this.planWhere(), orderBy: [{ publishedAt: 'desc' }, { version: 'desc' }], select: { id: true, version: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, plan: { select: { name: true } } } });
    if (!version || !version.price.eq(PRICE) || version.currency !== 'BRL') throw new ConflictException('Basic Plan is unavailable');
    const attempt = await this.prisma.pixPaymentAttempt.findFirst({ where: { organizationId, status: { in: ['PROCESSING', 'PAID'] } }, orderBy: { createdAt: 'desc' } });
    const now = new Date();
    const day = Math.min(Number(recifeCivilDate(now).slice(-2)), 28);
    return {
      plan: { code: BASIC, name: version.plan.name, version: version.version, price: version.price.toFixed(2), currency: version.currency, interval: version.interval, organizationLimit: version.organizationLimit, userLimit: version.userLimit },
      billingDay: day,
      confirmationRequired: true,
      attempt: attempt ? present(attempt) : null,
    };
  }

  async createPix(principal: AuthenticatedPrincipal, dto: ConfirmPixCheckoutDto) {
    const organizationId = this.requireAdmin(principal);
    if (dto.confirmed !== true) throw new BadRequestException('Basic Plan conditions must be explicitly confirmed');
    const now = new Date();
    const billingDay = Math.min(Number(recifeCivilDate(now).slice(-2)), 28);
    let createdId: string | null = null;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`;
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, commercialAccountId: true, name: true, email: true } });
      if (!organization?.commercialAccountId) throw new NotFoundException('Checkout not found');
      const version = await tx.planVersion.findFirst({ where: this.planWhere(), orderBy: [{ publishedAt: 'desc' }, { version: 'desc' }], select: { id: true, price: true, currency: true, interval: true, plan: { select: { name: true } } } });
      if (!version || !version.price.eq(PRICE) || version.currency !== 'BRL') throw new ConflictException('Basic Plan is unavailable');
      let subscription = await tx.subscription.findFirst({ where: { commercialAccountId: organization.commercialAccountId, status: { not: 'ENDED' } }, orderBy: { createdAt: 'desc' }, select: { id: true, trialEnabled: true, trialStartsAt: true, trialEndsAt: true } });
      if (!subscription) {
        subscription = await tx.subscription.create({ data: { commercialAccountId: organization.commercialAccountId, planVersionId: version.id, contractedPrice: version.price, contractedCurrency: version.currency, contractedInterval: version.interval, contractedOrganizationLimit: 1, contractedUserLimit: 3, contractedGracePeriodDays: 5, status: 'SCHEDULED', trialEnabled: false }, select: { id: true, trialEnabled: true, trialStartsAt: true, trialEndsAt: true } });
      } else {
        await tx.subscription.update({ where: { id: subscription.id }, data: { planVersionId: version.id, contractedPrice: version.price, contractedCurrency: version.currency, contractedInterval: version.interval, contractedOrganizationLimit: 1, contractedUserLimit: 3, contractedGracePeriodDays: 5, status: 'SCHEDULED', firstDueDate: recifeMidnight(recifeCivilDate(now)), billingDay } });
      }
      const charge = await tx.subscriptionCharge.findFirst({ where: { organizationId, subscriptionId: subscription.id, cancelledAt: null }, orderBy: { createdAt: 'desc' }, include: { settlements: { select: { amount: true } } } });
      let openCharge = charge && chargeBalance(charge).gt(0) ? charge : null;
      if (!openCharge) {
        openCharge = await tx.subscriptionCharge.create({ data: { commercialAccountId: organization.commercialAccountId, subscriptionId: subscription.id, organizationId, amount: version.price, dueDate: recifeMidnight(recifeCivilDate(now)), nature: 'FIRST_PAYMENT', billingPeriodStart: recifeMidnight(recifeCivilDate(now)), billingPeriodEnd: recifeMidnight(addCivilMonths(recifeCivilDate(now), 1)) }, include: { settlements: { select: { amount: true } } } });
      }
      const existing = await tx.pixPaymentAttempt.findFirst({ where: { chargeId: openCharge.id, status: { in: ['PROCESSING', 'PAID'] } }, orderBy: { createdAt: 'desc' } });
      if (existing && (!existing.expiresAt || existing.expiresAt > now || existing.status === 'PAID')) return existing;
      const idempotencyKey = `pix_${openCharge.id}_${now.getTime()}`;
      const attempt = await tx.pixPaymentAttempt.create({ data: { organizationId, commercialAccountId: organization.commercialAccountId, chargeId: openCharge.id, planVersionId: version.id, idempotencyKey, amount: version.price, currency: version.currency, planNameSnapshot: version.plan.name, planPriceSnapshot: version.price, planIntervalSnapshot: version.interval, billingDay }, });
      createdId = attempt.id;
      try {
        const pix = await this.provider.createPix({ amount: version.price.toFixed(2), currency: version.currency, reference: attempt.id, idempotencyKey });
        return await tx.pixPaymentAttempt.update({ where: { id: attempt.id }, data: { externalId: pix.externalId, qrCode: pix.qrCode, copyPasteCode: pix.copyPasteCode, expiresAt: pix.expiresAt }, });
      } catch (error) {
        await tx.pixPaymentAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED', failureReason: error instanceof Error ? error.message : 'Provider failure' } });
        throw error;
      }
    });
    void createdId;
    return present(result);
  }

  async webhook(signature: string | undefined, dto: AsaasWebhookDto) {
    this.verifySignature(signature, dto);
    const verified = await this.provider.verifyPayment(dto.payment.id);
    if (verified.externalId !== dto.payment.id) throw new UnauthorizedException('Invalid provider response');
    if (verified.status === 'PENDING') return { accepted: true, settled: false };
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.asaasWebhookEvent.findUnique({ where: { eventId: dto.id }, select: { id: true } });
      if (duplicate) return { accepted: true, duplicate: true, settled: false };
      const attempt = await tx.pixPaymentAttempt.findFirst({ where: { externalId: dto.payment.id }, include: { charge: { include: { settlements: { select: { id: true, amount: true, kind: true } } } } } });
      if (!attempt) throw new NotFoundException('Payment attempt not found');
      const amount = new Prisma.Decimal(String(verified.amount));
      if (!amount.eq(attempt.amount) || verified.currency !== attempt.currency || verified.reference !== attempt.id) throw new ConflictException('Provider payment does not match the open Charge');
      await tx.asaasWebhookEvent.create({ data: { eventId: dto.id, paymentAttemptId: attempt.id, eventType: dto.event, payload: dto as unknown as Prisma.InputJsonValue } });
      const reversal = verified.status === 'REFUNDED' || verified.status === 'CHARGEBACK';
      if (reversal) {
        const receipt = attempt.charge.settlements.find((item) => item.kind === ChargeSettlementKind.RECEIPT);
        if (receipt && !attempt.charge.settlements.some((item) => item.kind === ChargeSettlementKind.REVERSAL && item.amount.eq(receipt.amount.neg()))) {
          await tx.chargeSettlement.create({ data: { chargeId: attempt.chargeId, originalSettlementId: receipt.id, kind: 'REVERSAL', origin: 'GATEWAY', amount: receipt.amount.neg(), receivedAt: new Date(), effectiveAt: new Date(), provider: 'ASAAS', externalId: `${dto.payment.id}:reversal` } });
        }
        await tx.pixPaymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REVERSED' } });
        await tx.asaasWebhookEvent.update({ where: { eventId: dto.id }, data: { processedAt: new Date() } });
        return { accepted: true, settled: false, reversed: true };
      }
      if (!attempt.charge.settlements.some((item) => item.kind === ChargeSettlementKind.RECEIPT && item.amount.eq(attempt.amount))) {
        await tx.chargeSettlement.create({ data: { chargeId: attempt.chargeId, kind: 'RECEIPT', origin: 'GATEWAY', amount: attempt.amount, receivedAt: new Date(), provider: 'ASAAS', externalId: dto.payment.id } });
        const paidStart = recifeCivilDate(new Date());
        await tx.subscription.update({ where: { id: attempt.charge.subscriptionId }, data: { status: 'CURRENT', firstPaymentReceivedAt: new Date(), firstPaidPeriodStartedAt: recifeMidnight(paidStart), currentPeriodStart: recifeMidnight(paidStart), currentPeriodEnd: recifeMidnight(addCivilMonths(paidStart, 1)) } });
      }
      await tx.pixPaymentAttempt.update({ where: { id: attempt.id }, data: { status: 'PAID' } });
      await tx.asaasWebhookEvent.update({ where: { eventId: dto.id }, data: { processedAt: new Date() } });
      return { accepted: true, settled: true };
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

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PixPayment = {
  externalId: string;
  qrCode: string;
  copyPasteCode: string;
  expiresAt: Date;
};

export type VerifiedPayment = {
  externalId: string;
  status: 'RECEIVED' | 'REFUNDED' | 'CHARGEBACK' | 'PENDING' | 'FAILED' | 'EXPIRED';
  amount: string;
  currency: string;
  reference: string;
  customerReference?: string;
  paymentMethodReference?: string;
};

export type HostedCardCheckout = {
  externalId: string;
  checkoutUrl: string;
  expiresAt: Date;
  customerReference?: string;
  paymentMethodReference?: string;
};

export interface PixPaymentProvider {
  createPix(input: { amount: string; currency: string; reference: string; idempotencyKey: string }): Promise<PixPayment>;
  verifyPayment(externalId: string): Promise<VerifiedPayment>;
}

export interface CardPaymentProvider extends PixPaymentProvider {
  createHostedCardCheckout(input: { amount: string; currency: string; reference: string; idempotencyKey: string; authorizeRenewal: boolean }): Promise<HostedCardCheckout>;
  createAuthorizedRenewal(input: { amount: string; currency: string; reference: string; idempotencyKey: string; customerReference: string; paymentMethodReference: string }): Promise<{ externalId: string; expiresAt: Date }>;
}

@Injectable()
export class AsaasPaymentProvider implements CardPaymentProvider {
  private readonly captured = new Map<string, VerifiedPayment>();

  constructor(private readonly config: ConfigService) {}

  async createPix(input: { amount: string; currency: string; reference: string; idempotencyKey: string }): Promise<PixPayment> {
    const mode = this.config.get<string>('ASAAS_MODE') ?? 'capture';
    if (mode === 'capture') {
      const externalId = `capture_${input.idempotencyKey}`;
      this.captured.set(externalId, { externalId, status: 'PENDING', amount: input.amount, currency: input.currency, reference: input.reference });
      return { externalId, qrCode: `capture-qr:${externalId}`, copyPasteCode: `00020126580014BR.GOV.BCB.PIX0136${externalId}`, expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
    }
    throw new ServiceUnavailableException('Asaas PIX provider is not configured');
  }

  async verifyPayment(externalId: string): Promise<VerifiedPayment> {
    const payment = this.captured.get(externalId);
    if (payment) return payment;
    throw new ServiceUnavailableException('Unable to verify Asaas payment');
  }

  async createHostedCardCheckout(input: { amount: string; currency: string; reference: string; idempotencyKey: string; authorizeRenewal: boolean }): Promise<HostedCardCheckout> {
    const mode = this.config.get<string>('ASAAS_MODE') ?? 'capture';
    if (mode !== 'capture') throw new ServiceUnavailableException('Asaas card provider is not configured');
    const externalId = `capture_card_${input.idempotencyKey}`;
    const customerReference = `capture_customer_${input.reference}`;
    const paymentMethodReference = input.authorizeRenewal ? `capture_card_token_${input.reference}` : undefined;
    this.captured.set(externalId, { externalId, status: 'PENDING', amount: input.amount, currency: input.currency, reference: input.reference, customerReference, paymentMethodReference });
    return { externalId, checkoutUrl: `https://sandbox.asaas.example/checkout/${externalId}`, expiresAt: new Date(Date.now() + 30 * 60 * 1000), customerReference, paymentMethodReference };
  }

  async createAuthorizedRenewal(input: { amount: string; currency: string; reference: string; idempotencyKey: string; customerReference: string; paymentMethodReference: string }): Promise<{ externalId: string; expiresAt: Date }> {
    const mode = this.config.get<string>('ASAAS_MODE') ?? 'capture';
    if (mode !== 'capture') throw new ServiceUnavailableException('Asaas card provider is not configured');
    const externalId = `capture_renewal_${input.idempotencyKey}`;
    this.captured.set(externalId, { externalId, status: 'PENDING', amount: input.amount, currency: input.currency, reference: input.reference, customerReference: input.customerReference, paymentMethodReference: input.paymentMethodReference });
    return { externalId, expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
  }

  /** Capture-only test seam; production webhook tests can use the public webhook contract. */
  markCaptured(externalId: string, status: VerifiedPayment['status'] = 'RECEIVED') {
    const payment = this.captured.get(externalId);
    if (payment) payment.status = status;
  }
}

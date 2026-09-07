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
  status: 'RECEIVED' | 'REFUNDED' | 'CHARGEBACK' | 'PENDING';
  amount: string;
  currency: string;
  reference: string;
};

export interface PixPaymentProvider {
  createPix(input: { amount: string; currency: string; reference: string; idempotencyKey: string }): Promise<PixPayment>;
  verifyPayment(externalId: string): Promise<VerifiedPayment>;
}

@Injectable()
export class AsaasPaymentProvider implements PixPaymentProvider {
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

  /** Capture-only test seam; production webhook tests can use the public webhook contract. */
  markCaptured(externalId: string, status: VerifiedPayment['status'] = 'RECEIVED') {
    const payment = this.captured.get(externalId);
    if (payment) payment.status = status;
  }
}

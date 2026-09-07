import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type TransactionalMessage = { to: string; subject: string; text: string };

/** Narrow boundary for operational messages. Capture mode is deliberate for local/test environments. */
@Injectable()
export class TransactionalEmailService {
  private readonly captured: TransactionalMessage[] = [];

  constructor(private readonly config: ConfigService) {}

  async send(message: TransactionalMessage): Promise<void> {
    if (this.config.get<string>('EMAIL_DELIVERY_MODE') !== 'resend') {
      this.captured.push(message);
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.getOrThrow<string>('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.config.getOrThrow<string>('RESEND_FROM'), to: [message.to], subject: message.subject, text: message.text }),
    });
    if (!response.ok) throw new Error(`Transactional email delivery failed with status ${response.status}`);
  }

  capturedMessages(): readonly TransactionalMessage[] { return this.captured; }
}

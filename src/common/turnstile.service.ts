import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TurnstileService {
  constructor(private readonly config: ConfigService) {}

  async assertAllowed(token: string | undefined, remoteIp?: string): Promise<void> {
    if (!this.config.get<boolean>('TURNSTILE_REQUIRED')) return;
    if (!token) throw new HttpException('Suspicious traffic requires verification', HttpStatus.TOO_MANY_REQUESTS);
    const body = new URLSearchParams({ secret: this.config.getOrThrow<string>('TURNSTILE_SECRET_KEY'), response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const result = await response.json() as { success?: boolean };
    if (!response.ok || !result.success) throw new HttpException('Suspicious traffic requires verification', HttpStatus.TOO_MANY_REQUESTS);
  }
}

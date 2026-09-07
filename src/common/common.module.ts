import { Module } from '@nestjs/common';
import { TransactionalEmailService } from './transactional-email.service';
import { TurnstileService } from './turnstile.service';

@Module({ providers: [TransactionalEmailService, TurnstileService], exports: [TransactionalEmailService, TurnstileService] })
export class CommonModule {}

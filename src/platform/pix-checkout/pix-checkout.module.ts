import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AsaasPaymentProvider } from '../../payments/asaas-payment.provider';
import { AsaasWebhookController, PixCheckoutController } from './pix-checkout.controller';
import { PixCheckoutService } from './pix-checkout.service';
import { CardCheckoutService } from './card-checkout.service';

@Module({
  imports: [AuthModule, CommonModule, AuditEventsModule],
  controllers: [PixCheckoutController, AsaasWebhookController],
  providers: [AsaasPaymentProvider, PixCheckoutService, CardCheckoutService],
})
export class PixCheckoutModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { AsaasPaymentProvider } from '../../payments/asaas-payment.provider';
import { AsaasWebhookController, PixCheckoutController } from './pix-checkout.controller';
import { PixCheckoutService } from './pix-checkout.service';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [PixCheckoutController, AsaasWebhookController],
  providers: [AsaasPaymentProvider, PixCheckoutService],
})
export class PixCheckoutModule {}

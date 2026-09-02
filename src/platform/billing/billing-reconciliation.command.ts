import { Injectable } from '@nestjs/common';
import { SubscriptionChargesService } from '../subscription-charges/subscription-charges.service';

/** Internal cron seam. Infrastructure may invoke execute; application startup never does. */
@Injectable()
export class BillingReconciliationCommand {
  constructor(private readonly charges: SubscriptionChargesService) {}

  execute(asOf = new Date()) {
    return this.charges.reconcile(asOf);
  }
}

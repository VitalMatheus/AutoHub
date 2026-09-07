import { Injectable } from '@nestjs/common';
import { SubscriptionChargesService } from '../subscription-charges/subscription-charges.service';
import { BillingRemindersService } from './billing-reminders.service';

/** Internal cron seam. Infrastructure may invoke execute; application startup never does. */
@Injectable()
export class BillingReconciliationCommand {
  constructor(private readonly charges: SubscriptionChargesService, private readonly reminders: BillingRemindersService) {}

  async execute(asOf = new Date()) {
    const reconciliation = await this.charges.reconcile(asOf);
    return { ...reconciliation, reminders: await this.reminders.scheduleAndProcess(asOf) };
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TrialRemindersService } from './trial-reminders.service';

/** Infrastructure seam for the daily transactional-message worker. */
@Injectable()
export class TrialRemindersCommand implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly reminders: TrialRemindersService) {}

  private timer?: NodeJS.Timeout;

  onModuleInit(): void {
    this.timer = setInterval(() => { void this.execute().catch(() => undefined); }, 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  execute(asOf = new Date()) {
    return this.reminders.processDue(asOf);
  }
}

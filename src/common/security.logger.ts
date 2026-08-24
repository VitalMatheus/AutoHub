import { Injectable, Logger } from '@nestjs/common';

type SecurityEvent = {
  event: 'authentication.failure' | 'authorization.failure' | 'request.failure';
  method?: string;
  path?: string;
  status?: number;
  code?: string;
};

/** Emits security telemetry without accepting credentials or exception objects. */
@Injectable()
export class SecurityLogger {
  private readonly logger = new Logger('security');

  record(event: SecurityEvent): void {
    this.logger.warn(JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
  }
}

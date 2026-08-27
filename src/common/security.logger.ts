import { Injectable, Logger } from '@nestjs/common';

type SecurityEvent = {
  event: 'authentication.failure' | 'authorization.failure' | 'request.failure' | 'rate_limit.failure';
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
    // Keep this a single JSON line: log shippers can parse it without ever
    // receiving credentials, tokens, or exception internals.
    this.logger.warn(JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
  }
}

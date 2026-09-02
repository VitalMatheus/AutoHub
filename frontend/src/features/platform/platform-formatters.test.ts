import { describe, expect, it } from 'vitest';
import { formatPlatformDate, formatPlatformMoney, formatPlatformStatus } from './platform-formatters';

describe('platform display conventions', () => {
  it('formats money without floating point arithmetic in the UI contract', () => {
    expect(formatPlatformMoney('1.234,50')).toBe('R$ 1.234,50');
    expect(formatPlatformMoney('149.90')).toBe('R$ 149,90');
  });

  it('formats dates in the platform timezone', () => {
    expect(formatPlatformDate('2026-01-01T02:00:00.000Z')).toBe('31 de dez. de 2025');
  });

  it('translates backend statuses for user-facing labels', () => {
    expect(formatPlatformStatus('PENDING_ACTIVATION')).toBe('Aguardando ativação');
    expect(formatPlatformStatus('CUSTOM_STATUS')).toBe('custom status');
  });
});

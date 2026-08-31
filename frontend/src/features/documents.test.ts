import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { decimalMultiply } from './shared/document-components';
import { formatMoney, isValidMoney, normalizeMoney } from './shared/money';
import { addQuoteItem, quoteAction } from './quotes/api/quotes-api';
import { convertQuote, createWorkOrder, workOrderAction } from './work-orders/api/work-orders-api';

describe('document frontend contracts', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('calculates item totals with decimal strings', () => {
    expect(decimalMultiply('1.500', '149.90')).toBe('224.85');
    expect(decimalMultiply('3', '0.10')).toBe('0.30');
    expect(decimalMultiply('1,500', '149,90')).toBe('224.85');
  });

  it('normalizes and displays Brazilian monetary strings without floating point', () => {
    expect(normalizeMoney('5,50')).toBe('5.50');
    expect(normalizeMoney('1.234,56')).toBe('1234.56');
    expect(formatMoney('1234.5')).toBe('R$ 1.234,50');
    expect(formatMoney('5,50')).toBe('R$ 5,50');
    expect(formatMoney('1234567,8')).toBe('R$ 1.234.567,80');
    expect(isValidMoney('12,34')).toBe(true);
    expect(isValidMoney('1.234,56')).toBe(true);
    expect(isValidMoney('12.345')).toBe(false);
  });

  it('sends quote item and lifecycle requests to the tenant-scoped API', async () => {
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: {} } as never);

    await addQuoteItem('quote-1', { type: 'MANUAL', description: 'Troca', quantity: '1', unitPrice: '100,00' });
    await quoteAction('quote-1', 'approve');

    expect(post).toHaveBeenNthCalledWith(1, '/quotes/quote-1/items', { type: 'MANUAL', description: 'Troca', quantity: '1', unitPrice: '100.00' });
    expect(post).toHaveBeenNthCalledWith(2, '/quotes/quote-1/approve');
    expect(post.mock.calls.flat().join(' ')).not.toContain('organizationId');
  });

  it('creates a direct work order and converts an approved quote using explicit actions', async () => {
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: {} } as never);

    await createWorkOrder({ customerId: 'customer-1', vehicleId: 'vehicle-1', diagnosis: 'Freio', mileage: 12000 });
    await workOrderAction('work-order-1', 'complete');
    await convertQuote('quote-1');

    expect(post).toHaveBeenNthCalledWith(1, '/work-orders', { customerId: 'customer-1', vehicleId: 'vehicle-1', diagnosis: 'Freio', mileage: 12000 });
    expect(post).toHaveBeenNthCalledWith(2, '/work-orders/work-order-1/complete');
    expect(post).toHaveBeenNthCalledWith(3, '/work-orders/from-quote/quote-1');
  });
});

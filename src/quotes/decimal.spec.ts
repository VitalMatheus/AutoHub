import { sumTotals, totalOf } from './decimal';

describe('quote decimal totals', () => {
  it('multiplies quantity and price without floating point drift', () => {
    expect(totalOf('3.333', '10.10')).toBe('33.66');
  });

  it('sums rounded line totals as decimal strings', () => {
    expect(sumTotals([
      { quantity: '2', unitPrice: '149.90' },
      { quantity: '0.125', unitPrice: '80.00' },
    ])).toBe('309.80');
  });
});

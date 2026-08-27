const SCALE = 1000n;

export function fixedScale(value: { toString(): string } | string, scale: number): string {
  const [whole, fraction = ''] = value.toString().split('.');
  return `${whole}.${fraction.padEnd(scale, '0').slice(0, scale)}`;
}

export function decimalToScaled(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt((fraction + '000').slice(0, 3));
}

export function totalOf(quantity: string, unitPrice: string): string {
  const product = decimalToScaled(quantity) * decimalToScaled(unitPrice);
  const cents = (product + 5000n) / 10000n;
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function sumTotals(values: Array<{ quantity: string; unitPrice: string }>): string {
  const cents = values.reduce((sum, value) => {
    const product = decimalToScaled(value.quantity) * decimalToScaled(value.unitPrice);
    return sum + (product + 5000n) / 10000n;
  }, 0n);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

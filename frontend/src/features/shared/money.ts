export function normalizeMoney(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes(',')) return trimmed;
  const grouped = /^\d{1,3}(?:\.\d{3})+,\d+$/.test(trimmed);
  return (grouped ? trimmed.replace(/\./g, '') : trimmed).replace(',', '.');
}

export function isValidMoney(value: string): boolean {
  return /^\d+(?:\.\d{1,2})?$/.test(normalizeMoney(value));
}

export function formatMoney(value: string): string {
  const normalized = normalizeMoney(value);
  const sign = normalized.startsWith('-') ? '-' : '';
  const unsigned = sign ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.');
  const cents = `${fraction}00`.slice(0, 2);
  return `${sign}R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents}`;
}

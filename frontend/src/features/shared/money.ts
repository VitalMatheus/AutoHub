export function normalizeMoney(value: string): string {
  return value.replace(',', '.');
}

export function formatMoney(value: string): string {
  const normalized = normalizeMoney(value);
  const [whole, fraction = ''] = normalized.split('.');
  const cents = `${fraction}00`.slice(0, 2);
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents}`;
}

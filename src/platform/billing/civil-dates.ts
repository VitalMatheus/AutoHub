const TIME_ZONE = 'America/Recife';

export function recifeCivilDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export function addCivilDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function recifeMidnight(date: string): Date {
  return new Date(`${date}T00:00:00-03:00`);
}

export function addCivilMonths(date: string, months: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  const originalDay = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(originalDay, lastDay));
  return value.toISOString().slice(0, 10);
}

/** Return a monthly period boundary while retaining the original anchor day. */
export function addAnchoredCivilMonths(anchorDate: string, months: number): string {
  const anchor = new Date(`${anchorDate}T12:00:00Z`);
  const anchorDay = anchor.getUTCDate();
  const target = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(anchorDay, lastDay));
  return target.toISOString().slice(0, 10);
}

export const RECIFE_TIME_ZONE = TIME_ZONE;

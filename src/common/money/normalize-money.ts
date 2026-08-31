import { TransformFnParams } from 'class-transformer';

/** Converts the Brazilian decimal separator at the HTTP boundary only. */
export function normalizeMoney(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.includes(',')) return trimmed;
  const grouped = /^\d{1,3}(?:\.\d{3})+,\d+$/.test(trimmed);
  return (grouped ? trimmed.replace(/\./g, '') : trimmed).replace(',', '.');
}

export function normalizeMoneyTransform({ value }: TransformFnParams): unknown {
  return normalizeMoney(value);
}

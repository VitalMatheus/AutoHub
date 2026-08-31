import { TransformFnParams } from 'class-transformer';

/** Converts the Brazilian decimal separator at the HTTP boundary only. */
export function normalizeMoney(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(',', '.');
}

export function normalizeMoneyTransform({ value }: TransformFnParams): unknown {
  return normalizeMoney(value);
}

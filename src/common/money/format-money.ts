import { Prisma } from '@prisma/client';

export function formatMoney(value: Prisma.Decimal | string): string {
  return new Prisma.Decimal(value).toFixed(2);
}

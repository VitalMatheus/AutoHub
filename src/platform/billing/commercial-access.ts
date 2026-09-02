import { Prisma } from '@prisma/client';
import { addCivilDays, recifeCivilDate } from './civil-dates';

export type CommercialAccess = 'ACCESS_ALLOWED' | 'PAYMENT_GRACE_PERIOD' | 'PAYMENT_BLOCKED';

export type AccessCharge = {
  nature: string;
  dueDate: Date;
  amount: Prisma.Decimal;
  cancelledAt: Date | null;
  settlements: { amount: Prisma.Decimal }[];
};

export function chargeBalance(charge: Pick<AccessCharge, 'amount' | 'cancelledAt' | 'settlements'>): Prisma.Decimal {
  if (charge.cancelledAt) return new Prisma.Decimal(0);
  return charge.amount.sub(charge.settlements.reduce((sum, settlement) => sum.add(settlement.amount), new Prisma.Decimal(0)));
}

export function deriveCommercialAccess(charges: AccessCharge[], asOf = new Date()): {
  commercialAccess: CommercialAccess;
  delinquent: boolean;
  paymentGracePeriod: boolean;
} {
  const today = recifeCivilDate(asOf);
  let paymentGracePeriod = false;
  let delinquent = false;

  for (const charge of charges) {
    if (!chargeBalance(charge).gt(0)) continue;
    const due = charge.dueDate.toISOString().slice(0, 10);
    const overdue = today > due;
    if (overdue) delinquent = true;
    const blockingDate = addCivilDays(due, charge.nature === 'RENEWAL' ? 6 : 1);
    if (today >= blockingDate) return { commercialAccess: 'PAYMENT_BLOCKED', delinquent, paymentGracePeriod: false };
    if (charge.nature === 'RENEWAL' && overdue) paymentGracePeriod = true;
  }

  return {
    commercialAccess: paymentGracePeriod ? 'PAYMENT_GRACE_PERIOD' : 'ACCESS_ALLOWED',
    delinquent,
    paymentGracePeriod,
  };
}

import { addCivilDays, recifeCivilDate } from './civil-dates';

export const FinancialStandingStatus = {
  CURRENT: 'CURRENT',
  DUE_SOON: 'DUE_SOON',
  OVERDUE: 'OVERDUE',
  PAYMENT_BLOCKED: 'PAYMENT_BLOCKED',
} as const;

export type FinancialStandingStatus = typeof FinancialStandingStatus[keyof typeof FinancialStandingStatus];

export type FinancialStanding = {
  status: FinancialStandingStatus;
  dueToday: boolean;
  dueDate: Date | null;
};

export function deriveFinancialStanding(dueDate: Date | null, asOf = new Date()): FinancialStanding {
  if (!dueDate) return { status: 'CURRENT', dueToday: false, dueDate: null };

  const today = recifeCivilDate(asOf);
  const due = dueDate.toISOString().slice(0, 10);
  if (today === due) return { status: 'CURRENT', dueToday: true, dueDate };
  const status = today >= addCivilDays(due, 6)
    ? 'PAYMENT_BLOCKED'
    : today > due
      ? 'OVERDUE'
      : today >= addCivilDays(due, -5)
        ? 'DUE_SOON'
        : 'CURRENT';

  return { status, dueToday: false, dueDate };
}

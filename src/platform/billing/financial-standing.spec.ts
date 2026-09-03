import { deriveFinancialStanding } from './financial-standing';

describe('deriveFinancialStanding', () => {
  const dueDate = new Date('2026-09-15T00:00:00.000Z');

  it.each([
    ['six days before', '2026-09-09T12:00:00.000Z', 'CURRENT'],
    ['five days before', '2026-09-10T12:00:00.000Z', 'DUE_SOON'],
  ])('is %s in America/Recife', (_label, instant, status) => {
    expect(deriveFinancialStanding(dueDate, new Date(instant))).toEqual({
      status,
      dueToday: false,
      dueDate,
    });
  });

  it.each([
    ['start of the due date', '2026-09-15T03:00:00.000Z'],
    ['end of the due date', '2026-09-16T02:59:59.999Z'],
  ])('remains current for the %s and identifies that it is due today', (_label, instant) => {
    expect(deriveFinancialStanding(dueDate, new Date(instant))).toEqual({
      status: 'CURRENT',
      dueToday: true,
      dueDate,
    });
  });

  it.each([
    ['first complete civil day after the due date', '2026-09-16T03:00:00.000Z'],
    ['fifth complete civil day after the due date', '2026-09-21T02:59:59.999Z'],
  ])('is overdue on the %s', (_label, instant) => {
    expect(deriveFinancialStanding(dueDate, new Date(instant))).toEqual({
      status: 'OVERDUE',
      dueToday: false,
      dueDate,
    });
  });

  it('is payment blocked when the sixth civil day after the due date starts', () => {
    expect(deriveFinancialStanding(dueDate, new Date('2026-09-21T03:00:00.000Z'))).toEqual({
      status: 'PAYMENT_BLOCKED',
      dueToday: false,
      dueDate,
    });
  });
});

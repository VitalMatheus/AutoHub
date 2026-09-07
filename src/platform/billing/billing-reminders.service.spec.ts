import { Prisma } from '@prisma/client';
import { BillingRemindersService } from './billing-reminders.service';

describe('BillingRemindersService', () => {
  const dueDate = new Date('2026-09-15T03:00:00.000Z');

  it('schedules Recife pre-due, due-date, and tolerance reminders idempotently for active PIX admins', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      subscriptionCharge: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'charge-1', amount: new Prisma.Decimal('79.00'), dueDate, cancelledAt: null,
          settlements: [],
          organization: { id: 'org-1', users: [{ id: 'admin-1' }] },
        }]),
      },
      subscriptionChargeReminder: { createMany },
    } as any;
    const service = new BillingRemindersService(prisma, {} as any);

    await expect(service.schedule(new Date('2026-09-10T03:00:00.000Z'))).resolves.toEqual({ scheduled: 3 });
    expect(createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ kind: 'PRE_DUE', scheduledAt: new Date('2026-09-10T03:00:00.000Z') }),
        expect.objectContaining({ kind: 'DUE_DATE', scheduledAt: new Date('2026-09-15T03:00:00.000Z') }),
        expect.objectContaining({ kind: 'TOLERANCE_END', scheduledAt: new Date('2026-09-20T03:00:00.000Z') }),
      ]),
      skipDuplicates: true,
    });
  });

  it('does not send an overdue reminder after full settlement', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const email = { send: jest.fn() };
    const prisma = {
      subscriptionChargeReminder: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'reminder-1', kind: 'TOLERANCE_END', claimedAt: null, sentAt: null,
          recipientUser: { email: 'admin@example.com' },
          charge: {
            amount: new Prisma.Decimal('79.00'), cancelledAt: null, dueDate,
            settlements: [{ amount: new Prisma.Decimal('79.00') }],
            subscription: { status: 'CURRENT', cardRenewalAuthorized: false },
          },
        }]),
        updateMany,
      },
    } as any;
    const service = new BillingRemindersService(prisma, email as any);

    await expect(service.processDue(new Date('2026-09-20T03:00:00.000Z'))).resolves.toEqual({ sent: 0, skipped: 1 });
    expect(email.send).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { sentAt: new Date('2026-09-20T03:00:00.000Z') } }));
  });
});

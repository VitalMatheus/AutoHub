import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionChargeReminderKind } from '@prisma/client';
import { TransactionalEmailService } from '../../common/transactional-email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { addCivilDays, recifeCivilDate, recifeMidnight } from './civil-dates';
import { chargeBalance } from './commercial-access';

const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const REMINDERS: Array<{ kind: SubscriptionChargeReminderKind; daysFromDue: number }> = [
  { kind: 'PRE_DUE', daysFromDue: -5 },
  { kind: 'DUE_DATE', daysFromDue: 0 },
  // The block begins on day six; this message is sent at the end of the
  // existing five complete overdue-day tolerance.
  { kind: 'TOLERANCE_END', daysFromDue: 5 },
];

@Injectable()
export class BillingRemindersService {
  constructor(private readonly prisma: PrismaService, private readonly email: TransactionalEmailService) {}

  async schedule(asOf = new Date()): Promise<{ scheduled: number }> {
    const charges = await this.prisma.subscriptionCharge.findMany({
      where: {
        nature: { in: ['FIRST_PAYMENT', 'RENEWAL'] },
        cancelledAt: null,
        organizationId: { not: null },
        subscription: { status: { not: 'ENDED' }, cardRenewalAuthorized: false },
      },
      include: {
        settlements: { select: { amount: true } },
        organization: { select: { id: true, users: { where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } } } },
      },
    });

    let scheduled = 0;
    for (const charge of charges) {
      if (!charge.organization || !chargeBalance(charge).gt(0)) continue;
      const dueDate = recifeCivilDate(charge.dueDate);
      const data = charge.organization.users.flatMap((user) => REMINDERS.map(({ kind, daysFromDue }) => ({
        commercialAccountId: charge.commercialAccountId,
        chargeId: charge.id,
        organizationId: charge.organization!.id,
        recipientUserId: user.id,
        kind,
        scheduledAt: recifeMidnight(addCivilDays(dueDate, daysFromDue)),
      })));
      if (!data.length) continue;
      const result = await this.prisma.subscriptionChargeReminder.createMany({ data, skipDuplicates: true });
      scheduled += result.count;
    }
    return { scheduled };
  }

  async processDue(asOf = new Date()): Promise<{ sent: number; skipped: number }> {
    const candidates = await this.prisma.subscriptionChargeReminder.findMany({
      where: {
        scheduledAt: { lte: asOf },
        sentAt: null,
        OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(asOf.getTime() - CLAIM_TIMEOUT_MS) } }],
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: 100,
      include: {
        recipientUser: { select: { email: true } },
        charge: {
          select: {
            amount: true,
            cancelledAt: true,
            dueDate: true,
            settlements: { select: { amount: true } },
            subscription: { select: { status: true, cardRenewalAuthorized: true } },
          },
        },
      },
    });

    let sent = 0;
    let skipped = 0;
    for (const reminder of candidates) {
      const claimed = await this.prisma.subscriptionChargeReminder.updateMany({
        where: {
          id: reminder.id,
          sentAt: null,
          OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(asOf.getTime() - CLAIM_TIMEOUT_MS) } }],
        },
        data: { claimedAt: asOf },
      });
      if (claimed.count !== 1) {
        skipped++;
        continue;
      }

      const open = reminder.charge.subscription.status !== 'ENDED'
        && !reminder.charge.subscription.cardRenewalAuthorized
        && chargeBalance(reminder.charge).gt(0);
      if (!open) {
        await this.prisma.subscriptionChargeReminder.updateMany({ where: { id: reminder.id, claimedAt: asOf, sentAt: null }, data: { sentAt: asOf } });
        skipped++;
        continue;
      }

      try {
        await this.email.send(this.message(reminder.kind, reminder.recipientUser.email, reminder.charge.amount, reminder.charge.dueDate));
        await this.prisma.subscriptionChargeReminder.updateMany({ where: { id: reminder.id, claimedAt: asOf, sentAt: null }, data: { sentAt: new Date() } });
        sent++;
      } catch (error) {
        await this.prisma.subscriptionChargeReminder.updateMany({ where: { id: reminder.id, claimedAt: asOf, sentAt: null }, data: { claimedAt: null } });
        throw error;
      }
    }
    return { sent, skipped };
  }

  async scheduleAndProcess(asOf = new Date()) {
    const scheduled = await this.schedule(asOf);
    const processed = await this.processDue(asOf);
    return { ...scheduled, ...processed };
  }

  private message(kind: SubscriptionChargeReminderKind, to: string, amount: Prisma.Decimal, dueDate: Date) {
    const due = recifeCivilDate(dueDate);
    const copy = kind === 'PRE_DUE'
      ? `Sua cobrança mensal de R$ ${amount.toFixed(2)} vence em ${due}.`
      : kind === 'DUE_DATE'
        ? `Sua cobrança mensal de R$ ${amount.toFixed(2)} vence hoje (${due}).`
        : `Sua cobrança mensal de R$ ${amount.toFixed(2)} continua em aberto. O bloqueio comercial começa no próximo dia.`;
    return { to, subject: 'Lembrete de pagamento do Vekar', text: `${copy} Pague pelo PIX no Vekar para manter o acesso operacional.` };
  }
}

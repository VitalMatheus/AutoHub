import { Injectable } from '@nestjs/common';
import { Prisma, TrialReminderKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionalEmailService } from '../common/transactional-email.service';

const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const REMINDERS: Array<{ kind: TrialReminderKind; daysBeforeExpiry: number }> = [
  { kind: 'SEVEN_DAYS_REMAINING', daysBeforeExpiry: 7 },
  { kind: 'THREE_DAYS_REMAINING', daysBeforeExpiry: 3 },
  { kind: 'ONE_DAY_REMAINING', daysBeforeExpiry: 1 },
  { kind: 'EXPIRED', daysBeforeExpiry: 0 },
];

export type TrialReminderScheduleInput = {
  subscriptionId: string;
  commercialAccountId: string;
  organizationId: string;
  recipientUserId: string;
  trialEndsAt: Date;
};

@Injectable()
export class TrialRemindersService {
  constructor(private readonly prisma: PrismaService, private readonly email: TransactionalEmailService) {}

  async scheduleForConfirmation(tx: Prisma.TransactionClient, input: TrialReminderScheduleInput): Promise<void> {
    await tx.trialReminder.createMany({
      data: REMINDERS.map(({ kind, daysBeforeExpiry }) => ({
        subscriptionId: input.subscriptionId,
        commercialAccountId: input.commercialAccountId,
        organizationId: input.organizationId,
        recipientUserId: input.recipientUserId,
        kind,
        scheduledAt: new Date(input.trialEndsAt.getTime() - daysBeforeExpiry * 24 * 60 * 60 * 1000),
      })),
      skipDuplicates: true,
    });
  }

  async processDue(asOf = new Date()): Promise<{ sent: number; skipped: number }> {
    const candidates = await this.prisma.trialReminder.findMany({
      where: {
        scheduledAt: { lte: asOf },
        sentAt: null,
        OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(asOf.getTime() - CLAIM_TIMEOUT_MS) } }],
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: 100,
      include: {
        recipientUser: { select: { email: true } },
        subscription: { select: { trialEndsAt: true } },
      },
    });
    let sent = 0;
    let skipped = 0;
    for (const reminder of candidates) {
      const claimed = await this.prisma.trialReminder.updateMany({
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
      try {
        await this.email.send(this.message(reminder.kind, reminder.recipientUser.email, reminder.subscription.trialEndsAt));
        await this.prisma.trialReminder.updateMany({ where: { id: reminder.id, sentAt: null, claimedAt: asOf }, data: { sentAt: new Date() } });
        sent++;
      } catch (error) {
        await this.prisma.trialReminder.updateMany({ where: { id: reminder.id, sentAt: null, claimedAt: asOf }, data: { claimedAt: null } });
        throw error;
      }
    }
    return { sent, skipped };
  }

  private message(kind: TrialReminderKind, to: string, trialEndsAt: Date | null) {
    const endsAt = trialEndsAt?.toISOString() ?? 'the scheduled end of your Trial Period';
    if (kind === 'EXPIRED') {
      return { to, subject: 'Seu Trial Period terminou', text: `Seu Trial Period terminou em ${endsAt}. Seus dados permanecem disponíveis para consulta e exportação. Para continuar realizando alterações, contrate o Basic Plan.` };
    }
    const days = REMINDERS.find((reminder) => reminder.kind === kind)?.daysBeforeExpiry ?? 1;
    return { to, subject: `Seu Trial Period termina em ${days} ${days === 1 ? 'dia' : 'dias'}`, text: `Seu Trial Period termina em ${endsAt}. Complete os dados da oficina e registre suas primeiras operações antes do encerramento.` };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcquisitionFunnelStage, Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AcquisitionFunnelQueryDto } from './dto/acquisition-funnel-query.dto';

const STAGES: AcquisitionFunnelStage[] = [
  AcquisitionFunnelStage.REGISTRATION_STARTED,
  AcquisitionFunnelStage.EMAIL_CONFIRMED,
  AcquisitionFunnelStage.TRIAL_ACTIVE,
  AcquisitionFunnelStage.TRIAL_EXPIRED,
  AcquisitionFunnelStage.SUBSCRIBED,
];

@Injectable()
export class AcquisitionFunnelService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  subjectKey(subjectId: string): string {
    const pepper = this.config.get<string>('ACQUISITION_FUNNEL_PEPPER')
      ?? this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', pepper).update(`acquisition:${subjectId}`).digest('hex');
  }

  async record(tx: Prisma.TransactionClient, stage: AcquisitionFunnelStage, subjectId: string, occurredAt = new Date()): Promise<void> {
    await tx.acquisitionFunnelEvent.createMany({
      data: [{ stage, subjectKey: this.subjectKey(subjectId), occurredAt }],
      skipDuplicates: true,
    });
  }

  async metrics(dto: AcquisitionFunnelQueryDto) {
    const asOf = new Date();
    await this.syncDerivedStages(asOf);
    const where: Prisma.AcquisitionFunnelEventWhereInput = {
      occurredAt: { ...(dto.from ? { gte: new Date(dto.from) } : {}), ...(dto.to ? { lt: new Date(dto.to) } : {}), lte: asOf },
    };
    const rows = await this.prisma.acquisitionFunnelEvent.findMany({ where, select: { stage: true, subjectKey: true } });
    const counts = new Map<AcquisitionFunnelStage, number>(STAGES.map((stage) => [stage, 0]));
    for (const row of rows) counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1);
    const started = counts.get(AcquisitionFunnelStage.REGISTRATION_STARTED) ?? 0;
    return {
      asOf,
      stages: STAGES.map((stage) => {
        const count = counts.get(stage) ?? 0;
        return { stage, uniqueSubjects: count, conversionRate: started ? Number((count / started).toFixed(4)) : 0 };
      }),
    };
  }

  private async syncDerivedStages(asOf: Date): Promise<void> {
    const existing = await this.prisma.acquisitionFunnelEvent.findMany({
      where: { stage: AcquisitionFunnelStage.REGISTRATION_STARTED },
      select: { subjectKey: true },
    });
    if (!existing.length) return;
    const subjects = new Set(existing.map(({ subjectKey }) => subjectKey));
    const subscriptions = await this.prisma.subscription.findMany({
      where: { commercialAccountId: { not: null }, createdAt: { lte: asOf } },
      select: { commercialAccountId: true, trialStartsAt: true, trialEndsAt: true, firstPaymentReceivedAt: true },
    });
    await this.prisma.$transaction(async (tx) => {
      for (const subscription of subscriptions) {
        if (!subscription.commercialAccountId || !subjects.has(this.subjectKey(subscription.commercialAccountId))) continue;
        if (subscription.trialStartsAt && subscription.trialStartsAt <= asOf) {
          await this.record(tx, AcquisitionFunnelStage.TRIAL_ACTIVE, subscription.commercialAccountId, subscription.trialStartsAt);
        }
        if (subscription.trialEndsAt && subscription.trialEndsAt <= asOf && (!subscription.firstPaymentReceivedAt || subscription.firstPaymentReceivedAt > subscription.trialEndsAt)) {
          await this.record(tx, AcquisitionFunnelStage.TRIAL_EXPIRED, subscription.commercialAccountId, subscription.trialEndsAt);
        }
        if (subscription.firstPaymentReceivedAt && subscription.firstPaymentReceivedAt <= asOf) {
          await this.record(tx, AcquisitionFunnelStage.SUBSCRIBED, subscription.commercialAccountId, subscription.firstPaymentReceivedAt);
        }
      }
    });
  }
}

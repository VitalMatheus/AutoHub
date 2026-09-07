import { ConfigService } from '@nestjs/config';
import { AcquisitionFunnelStage } from '@prisma/client';
import { AcquisitionFunnelService } from './acquisition-funnel.service';

describe('AcquisitionFunnelService', () => {
  it('reports only pseudonymous commercial stages and never returns personal or operational payloads', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined), getOrThrow: jest.fn().mockReturnValue('f'.repeat(32)) } as unknown as ConfigService;
    const service = new AcquisitionFunnelService({} as never, config);
    const subjectKey = service.subjectKey('commercial-account-1');
    const eventFindMany = jest.fn()
      .mockResolvedValueOnce([{ subjectKey }])
      .mockResolvedValueOnce([
        { stage: AcquisitionFunnelStage.REGISTRATION_STARTED, subjectKey },
        { stage: AcquisitionFunnelStage.EMAIL_CONFIRMED, subjectKey },
        { stage: AcquisitionFunnelStage.TRIAL_ACTIVE, subjectKey },
        { stage: AcquisitionFunnelStage.TRIAL_EXPIRED, subjectKey },
      ]);
    const subscriptionFindMany = jest.fn().mockResolvedValue([{
      commercialAccountId: 'commercial-account-1',
      trialStartsAt: new Date('2026-09-01T00:00:00Z'),
      trialEndsAt: new Date('2026-09-15T00:00:00Z'),
      firstPaymentReceivedAt: null,
    }]);
    const createMany = jest.fn();
    const prisma = {
      acquisitionFunnelEvent: { findMany: eventFindMany },
      subscription: { findMany: subscriptionFindMany },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({ acquisitionFunnelEvent: { createMany } })),
    };
    (service as unknown as { prisma: unknown }).prisma = prisma;

    const result = await service.metrics({});

    expect(result.stages).toEqual(expect.arrayContaining([
      { stage: AcquisitionFunnelStage.REGISTRATION_STARTED, uniqueSubjects: 1, conversionRate: 1 },
      { stage: AcquisitionFunnelStage.EMAIL_CONFIRMED, uniqueSubjects: 1, conversionRate: 1 },
      { stage: AcquisitionFunnelStage.TRIAL_ACTIVE, uniqueSubjects: 1, conversionRate: 1 },
      { stage: AcquisitionFunnelStage.TRIAL_EXPIRED, uniqueSubjects: 1, conversionRate: 1 },
      { stage: AcquisitionFunnelStage.SUBSCRIBED, uniqueSubjects: 0, conversionRate: 0 },
    ]));
    expect(createMany).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('email');
    expect(JSON.stringify(result)).not.toContain('CPF');
    expect(JSON.stringify(result)).not.toContain('payment');
    expect(JSON.stringify(result)).not.toContain('operational');
    expect(subscriptionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { commercialAccountId: true, trialStartsAt: true, trialEndsAt: true, firstPaymentReceivedAt: true },
    }));
  });

  it('uses a stable keyed pseudonym instead of returning the source identifier', () => {
    const config = { get: jest.fn().mockReturnValue('secret-pepper-123456'), getOrThrow: jest.fn() } as unknown as ConfigService;
    const service = new AcquisitionFunnelService({} as never, config);

    expect(service.subjectKey('email@example.com')).toMatch(/^[a-f0-9]{64}$/);
    expect(service.subjectKey('email@example.com')).not.toContain('email@example.com');
  });
});

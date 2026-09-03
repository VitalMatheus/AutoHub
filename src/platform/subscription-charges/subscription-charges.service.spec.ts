import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { deriveChargeCondition, SubscriptionChargesService } from './subscription-charges.service';
import { addAnchoredCivilMonths, addCivilDays, recifeCivilDate, recifeMidnight } from '../billing/civil-dates';
import { deriveCommercialAccess } from '../billing/commercial-access';

describe('deriveChargeCondition', () => {
  const charge = { amount: new Prisma.Decimal('100.00'), dueDate: new Date('2026-09-02T03:00:00Z'), cancelledAt: null, settlements: [] };
  it('keeps a charge pending through its civil due date and overdue on the following day', () => {
    expect(deriveChargeCondition(charge, new Date('2026-09-03T02:59:59Z'))).toMatchObject({ condition: 'PENDING', paidAmount: '0.00', outstandingAmount: '100.00' });
    expect(deriveChargeCondition(charge, new Date('2026-09-03T03:00:00Z')).condition).toBe('OVERDUE');
  });
  it('uses the Recife civil date at the UTC boundary', () => {
    const due = { ...charge, dueDate: new Date('2026-09-15T03:00:00Z') };
    expect(deriveChargeCondition(due, new Date('2026-09-15T02:59:59Z')).condition).toBe('PENDING');
    expect(deriveChargeCondition(due, new Date('2026-09-16T02:59:59Z')).condition).toBe('PENDING');
    expect(deriveChargeCondition(due, new Date('2026-09-16T03:00:00Z')).condition).toBe('OVERDUE');
  });
  it('derives partial and paid using decimal-safe arithmetic', () => {
    const asOf = new Date('2026-09-02T23:59:59Z');
    expect(deriveChargeCondition({ ...charge, settlements: [{ amount: new Prisma.Decimal('33.33') }] }, asOf)).toMatchObject({ condition: 'PARTIALLY_PAID', paidAmount: '33.33', outstandingAmount: '66.67' });
    expect(deriveChargeCondition({ ...charge, settlements: [{ amount: new Prisma.Decimal('33.33') }, { amount: new Prisma.Decimal('66.67') }] }, asOf).condition).toBe('PAID');
  });
  it('derives cancelled independently of settlements', () => {
    expect(deriveChargeCondition({ ...charge, cancelledAt: new Date(), settlements: [] }).condition).toBe('CANCELLED');
  });
});

describe('civil billing dates', () => {
  it('uses Recife civil boundaries, including the UTC previous evening', () => {
    expect(recifeCivilDate(new Date('2026-01-15T02:59:59.999Z'))).toBe('2026-01-14');
    expect(recifeCivilDate(new Date('2026-01-15T03:00:00.000Z'))).toBe('2026-01-15');
    expect(addCivilDays('2026-01-01', 13)).toBe('2026-01-14');
    expect(recifeMidnight('2026-01-15').toISOString()).toBe('2026-01-15T03:00:00.000Z');
  });

  it('retains day 31 after a short February and resumes it when available', () => {
    expect(addAnchoredCivilMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addAnchoredCivilMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addAnchoredCivilMonths('2026-01-31', 3)).toBe('2026-04-30');
  });
});

describe('commercial access grace boundaries', () => {
  const renewal = { nature: 'RENEWAL', amount: new Prisma.Decimal('79.00'), dueDate: new Date('2026-09-15T00:00:00Z'), cancelledAt: null, settlements: [] };

  it.each([
    ['due date', '2026-09-15T23:59:59Z', 'ACCESS_ALLOWED'],
    ['first overdue day', '2026-09-16T03:00:00Z', 'PAYMENT_GRACE_PERIOD'],
    ['last grace day', '2026-09-20T03:00:00Z', 'PAYMENT_GRACE_PERIOD'],
    ['sixth day', '2026-09-21T03:00:00Z', 'PAYMENT_BLOCKED'],
  ])('%s derives the expected access', (_label, instant, expected) => {
    expect(deriveCommercialAccess([renewal], new Date(instant)).commercialAccess).toBe(expected);
  });

  it('does not unblock for a partial settlement', () => {
    expect(deriveCommercialAccess([{ ...renewal, settlements: [{ amount: new Prisma.Decimal('78.99') }] }], new Date('2026-09-21T03:00:00Z')).commercialAccess).toBe('PAYMENT_BLOCKED');
  });
});

describe('SubscriptionChargesService settlement rules', () => {
  it('rejects future receipts before opening a transaction', async () => {
    const subject = new SubscriptionChargesService({} as never, {} as never);
    await expect(subject.settle({} as never, 'charge', { amount: '1.00', receivedAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toBeInstanceOf(Error);
  });

  it('updates the first paid period atomically only on integral settlement after a partial payment', async () => {
    const initial = { id: 'charge', nature: 'FIRST_PAYMENT', amount: new Prisma.Decimal('79.00'), dueDate: new Date('2026-01-14T00:00:00Z'), cancelledAt: null, settlements: [{ amount: new Prisma.Decimal('30.00') }], subscription: { id: 'sub' }, commercialAccountId: 'account' } as any;
    const paid = { ...initial, settlements: [{ amount: new Prisma.Decimal('30.00') }, { amount: new Prisma.Decimal('49.00') }] };
    const tx = {
      subscriptionCharge: { update: jest.fn(), findUnique: jest.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(paid), findUniqueOrThrow: jest.fn().mockResolvedValue(paid) },
      chargeSettlement: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'settlement' }) },
      subscription: { findUnique: jest.fn().mockResolvedValue({ trialEnabled: true, trialEndsAt: new Date('2026-01-15T03:00:00Z') }), update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const subject = new SubscriptionChargesService(prisma, { record: jest.fn() } as never);

    await subject.settle({} as never, 'charge', { amount: '49.00', receivedAt: '2026-01-10T12:00:00.000Z', reason: 'Test backdate' });

    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sub' }, data: expect.objectContaining({ firstPaymentReceivedAt: new Date('2026-01-10T12:00:00.000Z'), firstPaidPeriodStartedAt: new Date('2026-01-15T03:00:00.000Z') }) }));
  });

  it('emits one first charge on trial day 10 and remains idempotent', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'charge-1' });
    const tx = { subscriptionCharge: { create }, auditEvent: {} };
    const prisma = {
      subscription: { findMany: jest.fn().mockResolvedValue([{ id: 'sub', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), trialStartsAt: new Date('2026-01-01T12:00:00Z') }]) },
      $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)),
    } as never;
    const audit = { record: jest.fn() };
    const subject = new SubscriptionChargesService(prisma, audit as never);

    await expect(subject.reconcileFirstPayments(new Date('2026-01-10T03:00:00.000Z'))).resolves.toMatchObject({ created: 1 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nature: 'FIRST_PAYMENT', dueDate: new Date('2026-01-14T03:00:00.000Z') }) }));
  });

  it('excludes Pending Commercial Setup from first and renewal reconciliation', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const subject = new SubscriptionChargesService({ subscription: { findMany } } as never, { record: jest.fn() } as never);

    await subject.reconcile(new Date('2026-09-03T03:00:00.000Z'));

    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ firstDueDate: { not: null }, billingDay: { not: null } }) }));
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ firstDueDate: { not: null }, billingDay: { not: null } }) }));
  });

  it('creates missing anchored renewal periods and records SYSTEM audit events', async () => {
    const creates: any[] = [];
    const tx = { subscriptionCharge: { create: jest.fn(async ({ data }) => { creates.push(data); return { id: `charge-${creates.length}` }; }) } };
    const prisma = {
      subscription: {
        findMany: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'sub', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstPaidPeriodStartedAt: new Date('2026-01-31T03:00:00Z'), effectiveCancellationAt: null }])
          .mockResolvedValueOnce([]),
      },
      $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)),
    } as never;
    const audit = { record: jest.fn() };
    const subject = new SubscriptionChargesService(prisma, audit as never);

    await expect(subject.reconcile(new Date('2026-04-15T03:00:00Z'))).resolves.toMatchObject({ created: 2 });
    expect(creates.map((charge) => [charge.billingPeriodStart.toISOString().slice(0, 10), charge.billingPeriodEnd.toISOString().slice(0, 10)])).toEqual([
      ['2026-02-28', '2026-03-31'], ['2026-03-31', '2026-04-30'],
    ]);
    expect(audit.record).toHaveBeenCalledWith(tx, null, expect.objectContaining({ after: expect.objectContaining({ system: true }) }));
  });

  it('treats a concurrent unique conflict as an idempotent success', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
    const tx = { subscriptionCharge: { create: jest.fn().mockRejectedValue(conflict) } };
    const prisma = { subscription: { findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'sub', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstPaidPeriodStartedAt: new Date('2026-01-01T03:00:00Z'), effectiveCancellationAt: null }]).mockResolvedValueOnce([]) }, $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const subject = new SubscriptionChargesService(prisma, { record: jest.fn() } as never);
    await expect(subject.reconcile(new Date('2026-02-02T03:00:00Z'))).resolves.toMatchObject({ created: 0, chargeIds: [] });
  });
});

describe('simple monthly reconciliation', () => {
  it('creates the first monthly charge exactly five civil days before its contracted due date', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'charge-1' });
    const tx = {
      $executeRaw: jest.fn(),
      subscription: { findUnique: jest.fn().mockResolvedValue({ id: 'sub', commercialAccountId: 'account', status: 'CURRENT', effectiveCancellationAt: null, firstDueDate: new Date('2026-09-15T00:00:00Z'), billingDay: 15, contractedPrice: new Prisma.Decimal('79.00') }) },
      subscriptionCharge: { findMany: jest.fn().mockResolvedValue([]), create },
    };
    const prisma = {
      subscription: { findMany: jest.fn().mockResolvedValue([{ id: 'sub', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstDueDate: new Date('2026-09-15T00:00:00Z'), billingDay: 15, effectiveCancellationAt: null }]) },
      $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)),
    } as never;
    const subject = new SubscriptionChargesService(prisma, { record: jest.fn() } as never);

    await expect(subject.reconcileSimpleMonthlyCharges(new Date('2026-09-10T03:00:00.000Z'))).resolves.toMatchObject({ created: 1 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nature: 'FIRST_PAYMENT', dueDate: new Date('2026-09-15T03:00:00.000Z'), amount: new Prisma.Decimal('79.00') }) }));
  });

  it('does not create before the five-day window, for pending setup, cancelled subscriptions, or while an open charge exists', async () => {
    const create = jest.fn();
    const findMany = jest.fn().mockResolvedValue([]);
    const subscriptions = [
      { id: 'early', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstDueDate: new Date('2026-09-15'), billingDay: 15, effectiveCancellationAt: null },
      { id: 'pending', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstDueDate: null, billingDay: null, effectiveCancellationAt: null },
      { id: 'cancelled', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstDueDate: new Date('2026-09-15'), billingDay: 15, effectiveCancellationAt: new Date('2026-09-01') },
      { id: 'open', commercialAccountId: 'account', contractedPrice: new Prisma.Decimal('79.00'), firstDueDate: new Date('2026-09-15'), billingDay: 15, effectiveCancellationAt: null },
    ];
    const tx = { $executeRaw: jest.fn(), subscription: { findUnique: jest.fn() }, subscriptionCharge: { findMany, create } };
    tx.subscription.findUnique.mockImplementation(async ({ where: { id } }) => subscriptions.find((subscription) => subscription.id === id));
    findMany.mockImplementation(async ({ where: { subscriptionId } }) => subscriptionId === 'open' ? [{ amount: new Prisma.Decimal('79.00'), cancelledAt: null, settlements: [] }] : []);
    const prisma = { subscription: { findMany: jest.fn().mockResolvedValue(subscriptions) }, $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never;
    const subject = new SubscriptionChargesService(prisma, { record: jest.fn() } as never);

    await expect(subject.reconcileSimpleMonthlyCharges(new Date('2026-09-09T03:00:00.000Z'))).resolves.toMatchObject({ created: 0 });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns only the authenticated Organization monthly charge without commercial internals', async () => {
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-1', commercialAccountId: 'account-1' }) },
      subscriptionCharge: { findMany: jest.fn().mockResolvedValue([{
        id: 'charge-1', subscriptionId: 'sub-1', organizationId: null, commercialAccountId: 'account-1', amount: new Prisma.Decimal('79.00'),
        dueDate: new Date('2026-09-15T03:00:00Z'), nature: 'RENEWAL', billingPeriodStart: new Date('2026-09-15T03:00:00Z'), billingPeriodEnd: new Date('2026-10-15T03:00:00Z'),
        provider: 'secret-provider', externalId: 'secret-external-id', cancelledAt: null, createdAt: new Date(), updatedAt: new Date(),
        commercialAccount: { id: 'account-1', name: 'Account' }, subscription: { id: 'sub-1' }, organization: null, settlements: [],
      }]) },
    };
    const subject = new SubscriptionChargesService(prisma as never, {} as never);

    const result = await subject.accountCharge({ role: 'ADMIN', organizationId: 'org-1', id: 'admin-1' } as never);

    expect(result).toEqual(expect.objectContaining({ id: 'charge-1', organizationId: 'org-1', amount: '79.00', dueDate: '2026-09-15', outstandingAmount: '79.00' }));
    expect(result).not.toHaveProperty('commercialAccountId');
    expect(result).not.toHaveProperty('provider');
    expect(result).not.toHaveProperty('externalId');
  });

  it('keeps an open monthly charge payable after its Subscription is ended', async () => {
    const charge = {
      id: 'old-charge', subscriptionId: 'ended-subscription', organizationId: null, commercialAccountId: 'account-1', amount: new Prisma.Decimal('79.00'),
      dueDate: new Date('2026-09-01T03:00:00Z'), nature: 'RENEWAL', billingPeriodStart: new Date('2026-09-01T03:00:00Z'), billingPeriodEnd: new Date('2026-10-01T03:00:00Z'),
      provider: null, externalId: null, cancelledAt: null, createdAt: new Date(), updatedAt: new Date(), commercialAccount: { id: 'account-1', name: 'Account' },
      subscription: { id: 'ended-subscription' }, organization: null, settlements: [],
    };
    const findMany = jest.fn().mockImplementation(({ where }) => where.subscription?.status?.in?.includes('ENDED') ? [charge] : []);
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-1', commercialAccountId: 'account-1' }) },
      subscriptionCharge: { findMany },
    };
    const subject = new SubscriptionChargesService(prisma as never, {} as never);

    await expect(subject.accountCharge({ role: 'ADMIN', organizationId: 'org-1', id: 'admin-1' } as never)).resolves.toEqual(expect.objectContaining({
      id: 'old-charge', outstandingAmount: '79.00', condition: 'OVERDUE',
    }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ subscription: { status: { in: ['CURRENT', 'ENDED'] } } }) }));
  });
});

describe('administrative Subscription Charge settlement', () => {
  const principal = { id: 'admin', role: 'SUPER_ADMIN', name: 'Super Admin', email: 'admin@example.com' } as any;
  const charge = (settlements: { amount: Prisma.Decimal }[] = []) => ({
    id: 'charge', commercialAccountId: 'account', subscriptionId: 'subscription', organizationId: null,
    amount: new Prisma.Decimal('100.00'), dueDate: new Date('2026-09-01T03:00:00Z'), nature: 'RENEWAL',
    billingPeriodStart: null, billingPeriodEnd: null, provider: null, externalId: null, cancelledAt: null,
    createdAt: new Date(), updatedAt: new Date(), commercialAccount: null, subscription: { id: 'subscription' }, organization: null,
    settlements: settlements.map((item, index) => ({ id: `settlement-${index}`, originalSettlementId: null, kind: 'RECEIPT', origin: 'GATEWAY', method: null, ...item, receivedAt: new Date(), effectiveAt: null, reason: null, provider: 'gateway', externalId: `external-${index}`, createdAt: new Date() })),
  });

  function subject(row: any) {
    const tx = {
      subscriptionCharge: {
        update: jest.fn().mockResolvedValue({ id: 'charge' }),
        findUnique: jest.fn().mockResolvedValue(row),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...row, settlements: [...row.settlements, { amount: row.amount.sub(row.settlements.reduce((sum: Prisma.Decimal, item: { amount: Prisma.Decimal }) => sum.add(item.amount), new Prisma.Decimal(0))) }] }),
      },
      chargeSettlement: { create: jest.fn().mockResolvedValue({ id: 'administrative-settlement' }) },
      subscription: { update: jest.fn().mockResolvedValue({ id: 'subscription' }) },
    };
    const audit = { record: jest.fn() };
    const prisma = { $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) };
    return { service: new SubscriptionChargesService(prisma as never, audit as never), tx, audit };
  }

  it('settles exactly the full balance with method, effective date, administrative origin and audit in one transaction', async () => {
    const { service, tx, audit } = subject(charge([{ amount: new Prisma.Decimal('25.00') }]));
    await expect(service.administrativelySettle(principal, 'charge', { amount: '75.00', method: 'BANK_TRANSFER', effectiveAt: '2026-09-03T12:00:00.000Z', reason: 'Pagamento recebido fora do gateway' } as any)).resolves.toEqual(expect.objectContaining({ condition: 'PAID', outstandingAmount: '0.00' }));
    expect(tx.chargeSettlement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: new Prisma.Decimal('75.00'), origin: 'ADMINISTRATIVE', method: 'BANK_TRANSFER', receivedAt: new Date('2026-09-03T12:00:00.000Z'), effectiveAt: new Date('2026-09-03T12:00:00.000Z') }) }));
    expect(audit.record).toHaveBeenCalledWith(tx, principal, expect.objectContaining({ action: 'charge_settlement.administratively_settled', reason: 'Pagamento recebido fora do gateway' }));
  });

  it.each([
    ['partial', '74.99'], ['excess', '75.01'],
  ])('rejects %s administrative settlement', async (_label, amount) => {
    const { service, tx } = subject(charge([{ amount: new Prisma.Decimal('25.00') }]));
    await expect(service.administrativelySettle(principal, 'charge', { amount, method: 'PIX', effectiveAt: '2026-09-03T12:00:00.000Z', reason: 'Justificativa' } as any)).rejects.toThrow('full open Charge balance');
    expect(tx.chargeSettlement.create).not.toHaveBeenCalled();
  });

  it('rejects a second settlement, unsupported charge nature, future date and missing justification', async () => {
    await expect(subject(charge([{ amount: new Prisma.Decimal('100.00') }])).service.administrativelySettle(principal, 'charge', { amount: '100.00', method: 'PIX', effectiveAt: '2026-09-03T12:00:00.000Z', reason: 'Duplicate' } as any)).rejects.toThrow('already fully settled');
    await expect(subject({ ...charge(), nature: 'EXTRAORDINARY' }).service.administrativelySettle(principal, 'charge', { amount: '100.00', method: 'PIX', effectiveAt: '2026-09-03T12:00:00.000Z', reason: 'Wrong nature' } as any)).rejects.toThrow('Only monthly');
    await expect(subject(charge()).service.administrativelySettle(principal, 'charge', { amount: '100.00', method: 'PIX', effectiveAt: new Date(Date.now() + 86400000).toISOString(), reason: 'Future' } as any)).rejects.toThrow('future');
    await expect(subject(charge()).service.administrativelySettle(principal, 'charge', { amount: '100.00', method: 'PIX', effectiveAt: '2026-09-03T12:00:00.000Z', reason: '   ' } as any)).rejects.toThrow('reason is required');
  });

  it('does not allow non-super-admin callers', async () => {
    await expect(subject(charge()).service.administrativelySettle({ ...principal, role: 'ADMIN' }, 'charge', { amount: '100.00', method: 'PIX', effectiveAt: '2026-09-03T12:00:00.000Z', reason: 'Reason' } as any)).rejects.toThrow('Only a Super Admin');
  });

  it('marks a first monthly charge paid without changing administrative organization status', async () => {
    const { service, tx } = subject({ ...charge(), nature: 'FIRST_PAYMENT' });
    await service.administrativelySettle(principal, 'charge', { amount: '100.00', method: 'PIX', effectiveAt: '2026-09-03T12:00:00.000Z', reason: 'Baixa administrativa' } as any);
    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'subscription' },
      data: expect.objectContaining({ status: 'CURRENT', firstPaymentReceivedAt: new Date('2026-09-03T12:00:00.000Z') }),
    }));
  });
});

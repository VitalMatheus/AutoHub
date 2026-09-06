import { OrganizationsService } from './organizations.service';
import { Prisma } from '@prisma/client';
import { OrganizationCommercialAccessFilter, OrganizationLifecycleFilter } from './dto/list-organizations.dto';

describe('OrganizationsService commercial onboarding', () => {
  const principal = { id: 'super-admin', name: 'Super Admin', email: 'super@example.com', role: 'SUPER_ADMIN', organizationId: null } as const;

  afterEach(() => jest.useRealTimers());

  function setup(overrides: Record<string, unknown> = {}) {
    const tx = {
      planVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'version-basic', status: 'PUBLISHED', price: '79.00', currency: 'BRL', interval: 'MONTHLY', organizationLimit: 1, userLimit: 3, workOrderLimit: null, gracePeriodDays: 5, plan: { archivedAt: null } }), findUnique: jest.fn() },
      commercialAccount: { create: jest.fn().mockResolvedValue({ id: 'account-1', name: 'Oficina', billingEmail: null, billingDocument: null }), update: jest.fn().mockResolvedValue({}) },
      organization: { create: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Oficina', document: null, phone: null, email: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, operationalStatus: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), commercialAccount: { id: 'account-1', name: 'Oficina', primaryContactUserId: null } }), findMany: jest.fn(), findUnique: jest.fn() },
      user: { create: jest.fn().mockResolvedValue({ id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN', status: 'PENDING_ACTIVATION', organizationId: 'org-1' }) },
      actionToken: { create: jest.fn().mockResolvedValue({}) },
      subscription: { create: jest.fn().mockResolvedValue({ id: 'subscription-1', planVersionId: 'version-basic', status: 'CURRENT', trialEnabled: false, trialStartsAt: null, trialEndsAt: null, contractedPrice: new Prisma.Decimal('79.00'), firstDueDate: new Date('2026-10-10T00:00:00.000Z'), billingDay: 10 }), update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)), organization: tx.organization, ...overrides };
    const auditEvents = { record: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue(3) };
    return { service: new OrganizationsService(prisma as never, config as never, auditEvents as never), tx, prisma, auditEvents };
  }

  it('registers one workshop, its initial Admin and the AutoHub Basic Subscription atomically without a Trial Period', async () => {
    const { service, tx, auditEvents } = setup();

    const result = await service.create(principal, {
      name: ' Oficina ', phone: '(81) 99999-9999', admin: { name: ' Admin ', email: 'ADMIN@example.com' },
      firstDueDate: '2026-10-10', billingDay: 10,
    });

    expect(tx.commercialAccount.update).toHaveBeenCalledWith({ where: { id: 'account-1' }, data: { primaryContactOrganizationId: 'org-1', primaryContactUserId: 'admin-1' } });
    expect(tx.subscription.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: 'CURRENT', contractedPrice: new Prisma.Decimal('79.00'), firstDueDate: new Date('2026-10-10T00:00:00.000Z'),
      billingDay: 10, trialEnabled: false, trialStartsAt: null, trialEndsAt: null,
    }) }));
    expect(auditEvents.record).toHaveBeenCalledWith(expect.anything(), principal, expect.objectContaining({ action: 'subscription.created' }));
    expect(result).toEqual({
      organization: expect.objectContaining({ id: 'org-1' }),
      admin: expect.objectContaining({ id: 'admin-1', email: 'admin@example.com' }),
      activationSecret: expect.any(String),
    });
    expect(JSON.stringify(result)).not.toContain('commercialAccount');
    expect(JSON.stringify(result)).not.toContain('subscription');
    expect(JSON.stringify(auditEvents.record.mock.calls)).not.toContain(result.activationSecret);
    expect(tx.actionToken.create.mock.calls[0][0].data.tokenHash).not.toBe(result.activationSecret);
  });

  it('selects the Basic Plan by stable code instead of its display name', async () => {
    const { service, tx } = setup();

    await service.create(principal, {
      name: 'Oficina', phone: '81999999999', admin: { name: 'Admin', email: 'admin@example.com' },
      firstDueDate: '2026-10-10', billingDay: 10,
    });

    expect(tx.planVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { plan: { code: 'BASIC', archivedAt: null }, status: 'PUBLISHED' },
    }));
  });

  it('uses the explicitly contracted price and preserves optional registration data', async () => {
    const { service, tx } = setup();

    await service.create(principal, {
      name: 'Oficina', phone: '81999999999', document: '12.345.678/0001-99', notes: 'Contrato anual negociado',
      addressLine1: 'Rua A', addressLine2: 'Sala 2', city: 'Recife', state: 'PE', postalCode: '50000-000',
      admin: { name: 'Admin', email: 'admin@example.com' }, contractedPrice: '89.90', firstDueDate: '2026-10-15', billingDay: 15,
    });

    expect(tx.organization.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      document: '12345678000199', notes: 'Contrato anual negociado', addressLine1: 'Rua A', addressLine2: 'Sala 2',
      city: 'Recife', state: 'PE', postalCode: '50000-000',
    }) }));
    expect(tx.subscription.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ contractedPrice: new Prisma.Decimal('89.90') }) }));
  });

  it.each([
    [{ name: 'Oficina', phone: '81999999999', admin: { name: 'Admin', email: 'admin@example.com' }, contractedPrice: '0.00', firstDueDate: '2026-10-10', billingDay: 10 }, 'contractedPrice must be greater than zero'],
    [{ name: 'Oficina', phone: '81999999999', admin: { name: 'Admin', email: 'admin@example.com' }, firstDueDate: '2026-02-30', billingDay: 10 }, 'firstDueDate must be a valid civil date'],
  ])('rejects invalid registration commercial data before opening a transaction', async (dto, message) => {
    const { service, prisma } = setup();

    await expect(service.create(principal, dto)).rejects.toThrow(message);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rolls back the transaction when a provisioning step fails', async () => {
    const failure = new Error('token persistence failed');
    const { service, prisma, tx } = setup();
    tx.actionToken.create.mockRejectedValue(failure);

    await expect(service.create(principal, { name: 'Oficina', phone: '81999999999', admin: { name: 'Admin', email: 'admin@example.com' }, firstDueDate: '2026-10-10', billingDay: 10 })).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns commercial and derived access data without operational records', async () => {
    const { service, prisma } = setup();
    const dueDate = new Date('2026-09-01T00:00:00.000Z');
    prisma.organization.findMany = jest.fn().mockResolvedValue([{
      id: 'org-1', name: '  Oficina Central  ', document: '12345678000199', phone: null, email: 'office@example.com',
      addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, operationalStatus: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      commercialAccount: {
        id: 'account-1', name: 'Grupo Central', billingEmail: 'billing@example.com', billingDocument: null,
        primaryContactUserId: 'admin-1', primaryContactOrganizationId: 'org-1',
        primaryContact: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE', organizationId: 'org-1' },
        organizations: [{ id: 'org-1', operationalStatus: 'ACTIVE', users: [] }],
        subscriptions: [{ id: 'sub-1', status: 'CURRENT', contractedPrice: new Prisma.Decimal('79.90'), contractedCurrency: 'BRL', contractedInterval: 'MONTHLY',
          contractedOrganizationLimit: 1, contractedUserLimit: 3, contractedWorkOrderLimit: null, migratedAt: null, regularizedAt: null,
          commercialStartAt: new Date('2026-01-01T00:00:00.000Z'), trialEnabled: false, trialStartsAt: null, trialEndsAt: null,
          firstPaymentReceivedAt: new Date('2026-01-01T00:00:00.000Z'), firstPaidPeriodStartedAt: new Date('2026-01-01T00:00:00.000Z'),
          currentPeriodStart: new Date('2026-09-01T00:00:00.000Z'), currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
          cancellationRequestedAt: null, effectiveCancellationAt: null,
          planVersion: { id: 'version-basic', version: 1, plan: { id: 'plan-basic', name: 'AutoHub Básico' } },
          charges: [{ nature: 'RENEWAL', dueDate, amount: new Prisma.Decimal('79.90'), cancelledAt: null, settlements: [] }],
        }],
      },
    }]);

    const result = await service.list({ page: 1, pageSize: 20, search: '  GRUPO CENTRAL ', lifecycle: [OrganizationLifecycleFilter.DELINQUENT], commercialAccess: [OrganizationCommercialAccessFilter.PAYMENT_GRACE_PERIOD] });

    expect(result.data[0]).toEqual(expect.objectContaining({
      commercialAccount: expect.objectContaining({ id: 'account-1', name: 'Grupo Central' }),
      primaryContact: expect.objectContaining({ email: 'admin@example.com' }),
      plan: expect.objectContaining({ name: 'AutoHub Básico', version: 1 }),
      lifecycle: [OrganizationLifecycleFilter.DELINQUENT, OrganizationLifecycleFilter.PAID_CURRENT],
      commercialAccess: OrganizationCommercialAccessFilter.PAYMENT_GRACE_PERIOD,
      payment: expect.objectContaining({ outstandingAmount: '79.90' }),
      effectiveAccess: expect.objectContaining({ allowed: true }),
      administrativePending: [],
    }));
    expect(result.data[0]).not.toHaveProperty('customers');
    expect(result.meta.total).toBe(1);
  });

  it('filters Organizations by Financial Standing while keeping operational status separate', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T02:30:00.000Z'));
    const { service, prisma } = setup();
    const organization = (id: string, operationalStatus: 'ACTIVE' | 'SUSPENDED', dueDate: string) => ({
      id, name: id, document: null, phone: null, email: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null,
      operationalStatus, createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      commercialAccount: {
        id: `account-${id}`, name: id, billingEmail: null, billingDocument: null, primaryContactUserId: null, primaryContactOrganizationId: null,
        primaryContact: null, organizations: [{ id, operationalStatus, users: [] }],
        subscriptions: [{ id: `sub-${id}`, status: 'CURRENT', contractedPrice: new Prisma.Decimal('79.90'), contractedCurrency: 'BRL', contractedInterval: 'MONTHLY',
          contractedOrganizationLimit: 1, contractedUserLimit: 3, contractedWorkOrderLimit: null, migratedAt: null, regularizedAt: null,
          commercialStartAt: null, trialEnabled: false, trialStartsAt: null, trialEndsAt: null, firstPaymentReceivedAt: null, firstPaidPeriodStartedAt: null,
          currentPeriodStart: null, currentPeriodEnd: null, cancellationRequestedAt: null, effectiveCancellationAt: null, planVersion: null,
          charges: [{ nature: 'RENEWAL', dueDate: new Date(`${dueDate}T03:00:00.000Z`), amount: new Prisma.Decimal('79.90'), cancelledAt: null, settlements: [] }],
        }],
      },
    });
    prisma.organization.findMany = jest.fn().mockResolvedValue([
      organization('due-today-suspended', 'SUSPENDED', '2026-09-02'),
      organization('due-soon', 'ACTIVE', '2026-09-07'),
    ]);

    const result = await service.list({ page: 1, pageSize: 20, financialStanding: ['CURRENT'] } as never);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      id: 'due-today-suspended',
      operationalStatus: 'SUSPENDED',
      financialStanding: { status: 'CURRENT', dueToday: true, dueDate: new Date('2026-09-02T03:00:00.000Z') },
    }));
  });

  it('regularizes Pending Commercial Setup without creating retroactive charges and is idempotent', async () => {
    const { service, tx, prisma } = setup();
    const subscription = {
      id: 'sub-1', status: 'SCHEDULED', migratedAt: new Date('2026-01-01'), regularizedAt: null,
      contractedPrice: new Prisma.Decimal('79.00'), contractedCurrency: 'BRL', contractedInterval: 'MONTHLY',
      contractedOrganizationLimit: 1, contractedUserLimit: 3, contractedWorkOrderLimit: null,
      firstDueDate: null, billingDay: null, commercialStartAt: null, trialEnabled: false, trialStartsAt: null, trialEndsAt: null,
      firstPaymentReceivedAt: null, firstPaidPeriodStartedAt: null, currentPeriodStart: null, currentPeriodEnd: null,
      cancellationRequestedAt: null, effectiveCancellationAt: null, planVersion: null, charges: [],
    };
    const pending = {
      id: 'org-1', commercialAccountId: 'account-1', name: 'Oficina', document: null, phone: null, email: null,
      addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, operationalStatus: 'ACTIVE',
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), users: [],
      commercialAccount: { id: 'account-1', name: 'Oficina', billingEmail: null, billingDocument: null, primaryContactUserId: null, primaryContactOrganizationId: null, primaryContact: null, organizations: [{ id: 'org-1', operationalStatus: 'ACTIVE', users: [] }], subscriptions: [subscription] },
    };
    const configured = {
      ...pending,
      commercialAccount: { ...pending.commercialAccount, subscriptions: [{ ...subscription, regularizedAt: new Date('2026-09-03'), contractedPrice: new Prisma.Decimal('89.90'), firstDueDate: new Date('2026-10-10T00:00:00.000Z'), billingDay: 15 }] },
    };
    tx.organization.findUnique = jest.fn().mockResolvedValueOnce(pending).mockResolvedValue(configured);
    tx.subscription.update = jest.fn().mockResolvedValue({ id: 'sub-1' });
    prisma.organization.findUnique = tx.organization.findUnique;

    const dto = { contractedPrice: '89.90', firstDueDate: '2026-10-10', billingDay: 15 };
    await service.regularizeCommercialSetup(principal, 'org-1', dto);
    await service.regularizeCommercialSetup(principal, 'org-1', dto);

    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sub-1' },
      data: expect.objectContaining({ contractedPrice: new Prisma.Decimal('89.90'), firstDueDate: new Date('2026-10-10T00:00:00.000Z'), billingDay: 15 }),
    }));
    expect(tx).not.toHaveProperty('subscriptionCharge.create');
    const updateData = tx.subscription.update.mock.calls[0][0].data;
    expect(updateData).toEqual(expect.objectContaining({ trialEnabled: false }));
    expect(updateData).not.toHaveProperty('trialStartsAt');
    expect(updateData).not.toHaveProperty('trialEndsAt');
  });

  it.each([
    [{ contractedPrice: '0.00', firstDueDate: '2026-10-10', billingDay: 10 }, 'contractedPrice must be greater than zero'],
    [{ contractedPrice: '79.00', firstDueDate: '2026-02-30', billingDay: 10 }, 'firstDueDate must be a valid civil date'],
  ])('rejects invalid commercial setup before persistence', async (dto, message) => {
    const { service, tx } = setup();

    await expect(service.regularizeCommercialSetup(principal, 'org-1', dto)).rejects.toThrow(message);
    expect(tx.organization.findUnique).not.toHaveBeenCalled();
    expect(tx.subscription.update).not.toHaveBeenCalled();
  });

  it('rejects regularization when the Organization has no current Subscription', async () => {
    const { service, tx } = setup();
    tx.organization.findUnique.mockResolvedValue({ id: 'org-1', commercialAccountId: 'account-1', commercialAccount: { subscriptions: [] } });

    await expect(service.regularizeCommercialSetup(principal, 'org-1', {
      contractedPrice: '79.00', firstDueDate: '2026-10-10', billingDay: 10,
    })).rejects.toThrow('Current Subscription not found');
    expect(tx.subscription.update).not.toHaveBeenCalled();
  });

  it('rejects replacing an already configured commercial schedule', async () => {
    const { service, tx } = setup();
    tx.organization.findUnique.mockResolvedValue({
      id: 'org-1', commercialAccountId: 'account-1', commercialAccount: { subscriptions: [{
        id: 'sub-1', migratedAt: new Date('2026-01-01'), regularizedAt: new Date('2026-02-01'),
        contractedPrice: new Prisma.Decimal('79.00'), firstDueDate: new Date('2026-10-10'), billingDay: 10,
      }] },
    });

    await expect(service.regularizeCommercialSetup(principal, 'org-1', {
      contractedPrice: '89.90', firstDueDate: '2026-10-15', billingDay: 15,
    })).rejects.toThrow('Commercial setup is already configured with different values');
    expect(tx.subscription.update).not.toHaveBeenCalled();
  });
});

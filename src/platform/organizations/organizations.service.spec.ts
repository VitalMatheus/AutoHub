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
      organization: { create: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Oficina', document: null, phone: null, email: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, operationalStatus: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), commercialAccount: { id: 'account-1', name: 'Oficina', primaryContactUserId: null } }), findMany: jest.fn() },
      user: { create: jest.fn().mockResolvedValue({ id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN', status: 'PENDING_ACTIVATION', organizationId: 'org-1' }) },
      actionToken: { create: jest.fn().mockResolvedValue({}) },
      subscription: { create: jest.fn().mockResolvedValue({ id: 'subscription-1', planVersionId: 'version-basic', status: 'SCHEDULED', trialEnabled: true, trialStartsAt: null, trialEndsAt: null, contractedPrice: '79.00' }) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)), organization: tx.organization, ...overrides };
    const auditEvents = { record: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue(3) };
    return { service: new OrganizationsService(prisma as never, config as never, auditEvents as never), tx, prisma, auditEvents };
  }

  it('creates the Primary Contact in the same onboarding transaction and defers the default Trial', async () => {
    const { service, tx, auditEvents } = setup();

    const result = await service.create(principal, { name: 'Oficina', admin: { name: 'Admin', email: 'ADMIN@example.com' }, trialEnabled: true });

    expect(tx.commercialAccount.update).toHaveBeenCalledWith({ where: { id: 'account-1' }, data: { primaryContactOrganizationId: 'org-1', primaryContactUserId: 'admin-1' } });
    expect(tx.subscription.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ trialEnabled: true, trialStartsAt: null, trialEndsAt: null }) }));
    expect(auditEvents.record).toHaveBeenCalledWith(expect.anything(), principal, expect.objectContaining({ action: 'subscription.created' }));
    expect(result.activationToken).toEqual(expect.any(String));
    expect(JSON.stringify(auditEvents.record.mock.calls)).not.toContain(result.activationToken);
  });

  it('rolls back the transaction when a provisioning step fails', async () => {
    const failure = new Error('token persistence failed');
    const { service, prisma, tx } = setup();
    tx.actionToken.create.mockRejectedValue(failure);

    await expect(service.create(principal, { name: 'Oficina', adminName: 'Admin', adminEmail: 'admin@example.com' })).rejects.toBe(failure);
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
});

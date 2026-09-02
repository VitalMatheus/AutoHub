import { OrganizationsService } from './organizations.service';

describe('OrganizationsService commercial onboarding', () => {
  const principal = { id: 'super-admin', name: 'Super Admin', email: 'super@example.com', role: 'SUPER_ADMIN', organizationId: null } as const;

  function setup(overrides: Record<string, unknown> = {}) {
    const tx = {
      planVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'version-basic', status: 'PUBLISHED', price: '79.00', currency: 'BRL', interval: 'MONTHLY', organizationLimit: 1, userLimit: 3, workOrderLimit: null, gracePeriodDays: 5, plan: { archivedAt: null } }), findUnique: jest.fn() },
      commercialAccount: { create: jest.fn().mockResolvedValue({ id: 'account-1', name: 'Oficina', billingEmail: null, billingDocument: null }), update: jest.fn().mockResolvedValue({}) },
      organization: { create: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Oficina', document: null, phone: null, email: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, operationalStatus: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), commercialAccount: { id: 'account-1', name: 'Oficina', primaryContactUserId: null } }) },
      user: { create: jest.fn().mockResolvedValue({ id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN', status: 'PENDING_ACTIVATION', organizationId: 'org-1' }) },
      actionToken: { create: jest.fn().mockResolvedValue({}) },
      subscription: { create: jest.fn().mockResolvedValue({ id: 'subscription-1', planVersionId: 'version-basic', status: 'SCHEDULED', trialEnabled: true, trialStartsAt: null, trialEndsAt: null, contractedPrice: '79.00' }) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)), ...overrides };
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
});

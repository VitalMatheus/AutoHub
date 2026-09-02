import { NotFoundException } from '@nestjs/common';
import { CommercialAccountsService } from './commercial-accounts.service';

describe('CommercialAccountsService', () => {
  it('makes a missing primary contact explicit', async () => {
    const account = {
      id: 'account-1', name: 'Conta', billingEmail: null, billingDocument: null,
      primaryContactOrganizationId: null, primaryContactUserId: null, createdAt: new Date(), updatedAt: new Date(),
      primaryContact: null, organizations: [], subscriptions: [],
    };
    const prisma = {
      commercialAccount: { findUnique: jest.fn().mockResolvedValue(account) },
    };
    const subject = new CommercialAccountsService(prisma as never);

    await expect(subject.detail(account.id)).resolves.toEqual(expect.objectContaining({
      id: account.id, missingPrimaryContact: true, primaryContact: null,
    }));
  });

  it('returns the selected active admin without adding a permission', async () => {
    const account = {
      id: 'account-1', name: 'Conta', billingEmail: 'billing@example.com', billingDocument: null,
      primaryContactOrganizationId: 'org-1', primaryContactUserId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      primaryContact: { id: 'user-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE', organizationId: 'org-1' },
      organizations: [{ id: 'org-1', name: 'Oficina', operationalStatus: 'ACTIVE', createdAt: new Date() }], subscriptions: [],
    };
    const prisma = { commercialAccount: { findUnique: jest.fn().mockResolvedValue(account) } };
    const result = await new CommercialAccountsService(prisma as never).detail(account.id);

    expect(result.primaryContact).toEqual(expect.objectContaining({ role: 'ADMIN', status: 'ACTIVE' }));
    expect(result.primaryContact).not.toHaveProperty('permissions');
  });

  it('returns not found rather than exposing an arbitrary account', async () => {
    const prisma = { commercialAccount: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(new CommercialAccountsService(prisma as never).detail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

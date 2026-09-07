import { DataRetentionService } from './data-retention.service';

describe('DataRetentionService', () => {
  it('finalizes only after the retention deadline and revokes sessions and action tokens', async () => {
    const asOf = new Date('2099-05-03T00:00:00Z');
    const tx = {
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', dataFinalizedAt: null }), update: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }]), updateMany: jest.fn(), update: jest.fn(), },
      session: { updateMany: jest.fn() },
      actionToken: { updateMany: jest.fn() },
      commercialAccount: { update: jest.fn() },
      organization: { update: jest.fn() },
      customer: { updateMany: jest.fn() },
      supplier: { updateMany: jest.fn() },
      service: { updateMany: jest.fn() },
      product: { updateMany: jest.fn() },
      vehicle: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      quote: { updateMany: jest.fn() },
      workOrder: { updateMany: jest.fn() },
    };
    const audit = { record: jest.fn() };
    const service = new DataRetentionService({ $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never, audit as never);

    await expect(service.finalizeOrganization('sub-1', 'org-1', 'account-1', new Date('2099-05-02T00:00:00Z'), asOf)).resolves.toBe(true);
    expect(tx.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: asOf } }));
    expect(tx.actionToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { usedAt: asOf } }));
    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dataFinalizedAt: asOf, status: 'ENDED' }) }));
    expect(audit.record).toHaveBeenCalledWith(tx, null, expect.objectContaining({ action: 'subscription.data_finalized' }));
  });

  it('refuses finalization before the deadline', async () => {
    const service = new DataRetentionService({} as never, {} as never);
    await expect(service.finalizeOrganization('sub-1', 'org-1', 'account-1', new Date('2099-05-02T00:00:00Z'), new Date('2099-05-01T00:00:00Z'))).resolves.toBe(false);
  });
});

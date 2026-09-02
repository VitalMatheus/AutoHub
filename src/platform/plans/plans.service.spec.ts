import { ConflictException } from '@nestjs/common';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  const tx = { plan: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() }, planVersion: { findUnique: jest.fn(), update: jest.fn() } };
  const prisma = { $transaction: jest.fn((callback: (arg: typeof tx) => unknown) => callback(tx)) } as never;
  const audit = { record: jest.fn() } as never;
  const subject = new PlansService(prisma, audit);
  const principal = { id: 'u', name: 'SA', email: 'sa@test', role: 'SUPER_ADMIN', organizationId: null } as never;

  beforeEach(() => jest.clearAllMocks());

  it('does not archive the only plan available for new contracts', async () => {
    tx.plan.findUnique.mockResolvedValue({ id: 'p', archivedAt: null, versions: [{ id: 'v' }] });
    tx.plan.count.mockResolvedValue(1);
    await expect(subject.archive(principal, 'p')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.plan.update).not.toHaveBeenCalled();
  });

  it('rejects edits to a published version', async () => {
    tx.planVersion.findUnique.mockResolvedValue({ id: 'v', status: 'PUBLISHED' });
    await expect(subject.updateVersion(principal, 'v', {} as never)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.planVersion.update).not.toHaveBeenCalled();
  });
});

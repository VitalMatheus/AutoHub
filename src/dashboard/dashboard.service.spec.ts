import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const prisma = { customer: { count: jest.fn() }, workOrder: { count: jest.fn() }, quote: { count: jest.fn() }, $transaction: jest.fn() } as any;
  const subject = new DashboardService(prisma);
  const principal = { role: 'ADMIN', organizationId: 'org-a' } as any;
  beforeEach(() => jest.clearAllMocks());

  it('returns tenant-scoped counts for active customers, open work orders and pending quotes', async () => {
    prisma.$transaction.mockResolvedValue([12, 4, 3]);
    await expect(subject.summary(principal)).resolves.toEqual({ customers: 12, openWorkOrders: 4, pendingQuotes: 3 });
    expect(prisma.customer.count).toHaveBeenCalledWith({ where: { organizationId: 'org-a', active: true } });
    expect(prisma.workOrder.count).toHaveBeenCalledWith({ where: { organizationId: 'org-a', status: { in: ['OPEN', 'WAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS'] } } });
    expect(prisma.quote.count).toHaveBeenCalledWith({ where: { organizationId: 'org-a', status: 'PENDING' } });
  });

  it('rejects principals without an organization', async () => {
    await expect(subject.summary({ role: 'SUPER_ADMIN', organizationId: null } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

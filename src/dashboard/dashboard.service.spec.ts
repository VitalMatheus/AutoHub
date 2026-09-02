import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const tx: any = { organization: { findMany: jest.fn() }, subscription: { findMany: jest.fn() }, chargeSettlement: { findMany: jest.fn() }, auditEvent: { findMany: jest.fn() } };
  const prisma: any = { $transaction: jest.fn((callback) => callback(tx)) };
  const subject = new DashboardService(prisma);
  const superAdmin = { role: 'SUPER_ADMIN', organizationId: null } as any;
  const decimal = (value: string) => new Prisma.Decimal(value);
  const subscription = (overrides: any = {}) => ({ id: 'sub-1', commercialAccountId: 'account-1', status: 'CURRENT', contractedPrice: decimal('100.00'), trialEnabled: false, trialStartsAt: null, trialEndsAt: null, firstPaymentReceivedAt: new Date('2026-01-01T12:00:00Z'), firstPaidPeriodStartedAt: new Date('2026-01-01T03:00:00Z'), effectiveCancellationAt: null, migratedAt: null, regularizedAt: null, commercialStartAt: new Date('2026-01-01T03:00:00Z'), charges: [], ...overrides });
  beforeEach(() => { jest.clearAllMocks(); tx.organization.findMany.mockResolvedValue([]); tx.subscription.findMany.mockResolvedValue([]); tx.chargeSettlement.findMany.mockResolvedValue([]); tx.auditEvent.findMany.mockResolvedValue([]); });

  it('rejects Organization Admins before opening a database transaction', async () => {
    await expect(subject.summary({ role: 'ADMIN', organizationId: 'org-1' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns one Recife reference and keeps operational and commercial axes overlapping', async () => {
    tx.organization.findMany.mockResolvedValue([{ id: 'org-1', operationalStatus: 'SUSPENDED', commercialAccountId: 'account-1' }]);
    tx.subscription.findMany.mockResolvedValue([subscription({ effectiveCancellationAt: new Date('2026-01-25T03:00:00Z'), charges: [{ amount: decimal('100.00'), dueDate: new Date('2026-01-10T03:00:00Z'), nature: 'RENEWAL', cancelledAt: null, settlements: [] }] })]);
    tx.auditEvent.findMany.mockResolvedValueOnce([{ targetId: 'org-1' }]).mockResolvedValueOnce([{ targetId: 'account-1' }]).mockResolvedValueOnce([]);
    const result = await subject.summary(superAdmin, { asOf: '2026-01-20T12:00:00.000Z' });
    expect(result.referenceAt).toBe('2026-01-20T12:00:00.000Z');
    expect(result.timezone).toBe('America/Recife');
    expect(result.organizations).toEqual({ total: 1, active: 0, inactive: 0, suspended: 1, commerciallyBlocked: 1 });
    expect(result.subscriptions).toMatchObject({ paidCurrent: 1, delinquent: 1 });
    expect(result.monthly).toMatchObject({ newOrganizations: 1, newCommercialAccounts: 1 });
    expect(result.financial.mrr).toBe('100.00');
  });

  it('separates cash receipts and reversals from upcoming and overdue balances', async () => {
    tx.subscription.findMany.mockResolvedValue([subscription({ charges: [{ amount: decimal('100.00'), dueDate: new Date('2026-01-10T03:00:00Z'), nature: 'RENEWAL', cancelledAt: null, settlements: [{ amount: decimal('25.00') }] }, { amount: decimal('40.00'), dueDate: new Date('2026-02-01T03:00:00Z'), nature: 'EXTRAORDINARY', cancelledAt: null, settlements: [] }] })]);
    tx.chargeSettlement.findMany.mockResolvedValue([{ amount: decimal('50.00'), kind: 'RECEIPT', receivedAt: new Date('2026-01-05T12:00:00Z'), effectiveAt: null, charge: { cancelledAt: null } }, { amount: decimal('-10.00'), kind: 'REVERSAL', receivedAt: new Date('2026-01-06T12:00:00Z'), effectiveAt: new Date('2026-01-07T12:00:00Z'), charge: { cancelledAt: null } }]);
    const result = await subject.summary(superAdmin, { asOf: '2026-01-20T12:00:00.000Z' });
    expect(result.financial).toEqual({ mrr: '100.00', receivedRevenue: '40.00', pendingRevenue: { upcoming: '40.00', overdue: '75.00', total: '115.00' } });
  });
});

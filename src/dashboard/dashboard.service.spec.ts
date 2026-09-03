import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const tx: any = { organization: { findMany: jest.fn() }, subscription: { findMany: jest.fn() }, chargeSettlement: { findMany: jest.fn() }, auditEvent: { findMany: jest.fn() } };
  const prisma: any = { $transaction: jest.fn((callback) => callback(tx)) };
  const subject = new DashboardService(prisma);
  const superAdmin = { role: 'SUPER_ADMIN', organizationId: null } as any;
  const decimal = (value: string) => new Prisma.Decimal(value);
  const subscription = (overrides: any = {}) => ({ id: 'sub-1', commercialAccountId: 'account-1', status: 'CURRENT', contractedPrice: decimal('100.00'), createdAt: new Date('2026-01-01T03:00:00Z'), trialEnabled: false, trialStartsAt: null, trialEndsAt: null, firstPaymentReceivedAt: new Date('2026-01-01T12:00:00Z'), firstPaidPeriodStartedAt: new Date('2026-01-01T03:00:00Z'), effectiveCancellationAt: null, migratedAt: null, regularizedAt: null, commercialStartAt: new Date('2026-01-01T03:00:00Z'), firstDueDate: new Date('2026-01-10T00:00:00Z'), billingDay: 10, charges: [], ...overrides });
  beforeEach(() => { jest.clearAllMocks(); tx.organization.findMany.mockResolvedValue([]); tx.subscription.findMany.mockResolvedValue([]); tx.chargeSettlement.findMany.mockResolvedValue([]); tx.auditEvent.findMany.mockResolvedValue([]); });

  it('rejects Organization Admins before opening a database transaction', async () => {
    await expect(subject.summary({ role: 'ADMIN', organizationId: 'org-1' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns reduced metrics with independent operational and commercial states', async () => {
    tx.organization.findMany.mockResolvedValue([
      { id: 'org-current', name: 'Oficina Atual', operationalStatus: 'ACTIVE', commercialAccountId: 'account-current' },
      { id: 'org-overdue', name: 'Oficina em atraso', operationalStatus: 'SUSPENDED', commercialAccountId: 'account-overdue' },
      { id: 'org-blocked', name: 'Oficina bloqueada', operationalStatus: 'ACTIVE', commercialAccountId: 'account-blocked' },
    ]);
    tx.subscription.findMany.mockResolvedValue([
      subscription({ id: 'sub-current', commercialAccountId: 'account-current', charges: [{ amount: decimal('100.00'), dueDate: new Date('2026-01-30T03:00:00Z'), nature: 'RENEWAL', cancelledAt: null, settlements: [] }] }),
      subscription({ id: 'sub-overdue', commercialAccountId: 'account-overdue', charges: [{ amount: decimal('100.00'), dueDate: new Date('2026-01-15T03:00:00Z'), nature: 'RENEWAL', cancelledAt: null, settlements: [] }] }),
      subscription({ id: 'sub-blocked', commercialAccountId: 'account-blocked', charges: [{ amount: decimal('50.00'), dueDate: new Date('2026-01-01T03:00:00Z'), nature: 'RENEWAL', cancelledAt: null, settlements: [] }] }),
    ]);
    const result = await subject.summary(superAdmin, { asOf: '2026-01-20T12:00:00.000Z' });
    expect(result.organizations).toEqual({ total: 3, current: 1, dueSoon: 0, overdue: 1, paymentBlocked: 1, suspended: 1 });
    expect(result.financial).toEqual({ receivedRevenue: '0.00', openWithinDue: '100.00', overdue: '150.00' });
    expect(result.attentionOrganizations).toEqual(expect.arrayContaining([{ id: 'org-overdue', name: 'Oficina em atraso', reasons: ['OVERDUE', 'SUSPENDED'] }, { id: 'org-blocked', name: 'Oficina bloqueada', reasons: ['PAYMENT_BLOCKED'] }]));
    expect(result).not.toHaveProperty('series');
    expect(result).not.toHaveProperty('subscriptions');
  });

  it('uses the Recife civil date at the boundary and supports an empty dashboard', async () => {
    const result = await subject.summary(superAdmin, { asOf: '2026-01-20T02:59:59.999Z' });
    expect(result.referenceAt).toBe('2026-01-20T02:59:59.999Z');
    expect(result.timezone).toBe('America/Recife');
    expect(result.organizations).toEqual({ total: 0, current: 0, dueSoon: 0, overdue: 0, paymentBlocked: 0, suspended: 0 });
    expect(result.financial).toEqual({ receivedRevenue: '0.00', openWithinDue: '0.00', overdue: '0.00' });
    expect(result.attentionOrganizations).toEqual([]);
  });
});

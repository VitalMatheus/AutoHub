import { httpClient } from '@/shared/api/http';

export type DashboardSummary = { customers: number; openWorkOrders: number; pendingQuotes: number };

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return (await httpClient.get<DashboardSummary>('/dashboard')).data;
}

export type DashboardData = {
  referenceAt: string; timezone: string;
  organizations: { total: number; active: number; inactive: number; suspended: number; commerciallyBlocked: number };
  subscriptions: { trial: number; paidCurrent: number; awaitingFirstPayment: number; delinquent: number; effectivelyCancelled: number; pendingCommercialSetup: number };
  monthly: { newOrganizations: number; newCommercialAccounts: number; effectiveCancellations: number; operationalDeactivations: number };
  financial: { mrr: string; receivedRevenue: string; pendingRevenue: { upcoming: string; overdue: string; total: string } };
  series: Array<{ month: string; mrr: string; organizations: number; receivedRevenue: string; newOrganizations: number; newCommercialAccounts: number; effectiveCancellations: number; operationalDeactivations: number }>;
};

export type AuditEvent = { id: string; occurredAt: string; actor: { type: 'USER' | 'SYSTEM'; name: string | null; email: string | null }; action: string; target: { type: string; id: string }; reason: string | null };

export async function fetchDashboard(params: { from?: string; to?: string }): Promise<DashboardData> {
  return (await httpClient.get<DashboardData>('/dashboard', { params })).data;
}

export async function fetchRecentAuditEvents(): Promise<AuditEvent[]> {
  const response = await httpClient.get<{ data: AuditEvent[] }>('/platform/audit-events', { params: { pageSize: 5 } });
  return response.data?.data ?? [];
}

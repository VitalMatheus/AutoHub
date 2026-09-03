import { httpClient } from '@/shared/api/http';

export type DashboardSummary = { customers: number; openWorkOrders: number; pendingQuotes: number };

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return (await httpClient.get<DashboardSummary>('/dashboard')).data;
}

export type DashboardData = {
  referenceAt: string; timezone: string;
  organizations: { total: number; current: number; dueSoon: number; overdue: number; paymentBlocked: number; suspended: number };
  financial: { receivedRevenue: string; openWithinDue: string; overdue: string };
  attentionOrganizations: Array<{ id: string; name: string; reasons: string[] }>;
};

export type AuditEvent = { id: string; occurredAt: string; actor: { type: 'USER' | 'SYSTEM'; name: string | null; email: string | null }; action: string; target: { type: string; id: string }; reason: string | null };

export async function fetchDashboard(params?: { asOf?: string }): Promise<DashboardData> {
  return (await httpClient.get<DashboardData>('/dashboard', { params })).data;
}

export async function fetchRecentAuditEvents(): Promise<AuditEvent[]> {
  const response = await httpClient.get<{ data: AuditEvent[] }>('/platform/audit-events', { params: { pageSize: 5 } });
  return response.data?.data ?? [];
}

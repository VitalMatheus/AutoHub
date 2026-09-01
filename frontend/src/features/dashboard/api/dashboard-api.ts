import { httpClient } from '@/shared/api/http';

export type DashboardSummary = { customers: number; openWorkOrders: number; pendingQuotes: number };

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return (await httpClient.get<DashboardSummary>('/dashboard')).data;
}

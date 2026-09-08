import { httpClient } from '@/shared/api/http';

export type WorkshopDashboard = {
  referenceAt: string;
  timezone: string;
  organization: { id: string; name: string };
  trial: { status: 'ACTIVE' | 'EXPIRED'; endsAt: string; remainingDays: number; message: string } | null;
  metrics: { customers: number; vehicles: number; quotes: number; workOrders: number };
  activities: Array<{ type: string; label: string; description: string; occurredAt: string; href: string }>;
};

export async function fetchWorkshopDashboard() {
  return (await httpClient.get<WorkshopDashboard>('/account/dashboard')).data;
}

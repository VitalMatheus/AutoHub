import { httpClient } from '@/shared/api/http';

export type WorkshopDashboard = {
  referenceAt: string;
  timezone: string;
  organization: { id: string; name: string };
  trial: { status: 'ACTIVE' | 'EXPIRED'; endsAt: string; remainingDays: number; message: string } | null;
  checklist: Array<{ key: string; label: string; completed: boolean; href: string }>;
};

export async function fetchWorkshopDashboard() {
  return (await httpClient.get<WorkshopDashboard>('/account/dashboard')).data;
}

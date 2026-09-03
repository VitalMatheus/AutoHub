import { httpClient } from '@/shared/api/http';

export type PlanVersion = {
  id: string;
  planId: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | string;
  price: string;
  currency: string;
  interval: string;
  organizationLimit: number | null;
  userLimit: number | null;
  workOrderLimit: number | null;
  gracePeriodDays: number;
  publishedAt: string | null;
  createdAt: string;
  used?: boolean;
};

export type Plan = {
  id: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  versions: PlanVersion[];
};

export type PlanParams = { page: number; pageSize: number; search?: string };
export type PlanList = { data: Plan[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };

export const listPlans = (params: PlanParams) => httpClient.get<PlanList>('/platform/plans', { params }).then((response) => response.data);
export const getPlan = (id: string) => httpClient.get<Plan>(`/platform/plans/${id}`).then((response) => response.data);

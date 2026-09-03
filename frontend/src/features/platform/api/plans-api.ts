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

export type CreatePlanInput = { name: string };
export type PlanVersionInput = { price: string; currency?: string; interval?: string; organizationLimit: number; userLimit: number; workOrderLimit: number | null; gracePeriodDays: number };

export const listPlans = (params: PlanParams) => httpClient.get<PlanList>('/platform/plans', { params }).then((response) => response.data);
export const getPlan = (id: string) => httpClient.get<Plan>(`/platform/plans/${id}`).then((response) => response.data);
export const createPlan = (input: CreatePlanInput) => httpClient.post<Plan>('/platform/plans', input).then((response) => response.data);
export const updatePlan = (id: string, input: CreatePlanInput) => httpClient.patch<Plan>(`/platform/plans/${id}`, input).then((response) => response.data);
export const createPlanVersion = (planId: string, input: PlanVersionInput) => httpClient.post<PlanVersion>(`/platform/plans/${planId}/versions`, input).then((response) => response.data);
export const updatePlanVersion = (planId: string, versionId: string, input: PlanVersionInput) => httpClient.patch<PlanVersion>(`/platform/plans/${planId}/versions/${versionId}`, input).then((response) => response.data);
export const publishPlanVersion = (planId: string, versionId: string) => httpClient.post<PlanVersion>(`/platform/plans/${planId}/versions/${versionId}/publish`).then((response) => response.data);
export const deletePlanVersion = (planId: string, versionId: string) => httpClient.delete<{ deleted: true }>(`/platform/plans/${planId}/versions/${versionId}`).then((response) => response.data);
export const archivePlan = (id: string) => httpClient.post<Plan>(`/platform/plans/${id}/archive`).then((response) => response.data);

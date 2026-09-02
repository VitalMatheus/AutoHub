import { httpClient } from '@/shared/api/http';

export type Organization = { id: string; name: string; operationalStatus: string; commercialAccount: { id: string; name: string } | null; primaryContact: { name: string; email: string } | null; plan: { name: string; contractedPrice: string; contractedCurrency: string; contractedInterval: string } | null; nextBillingDate: string | null; payment: { condition: string; paidAmount: string; outstandingAmount: string }; commercialAccess: string; effectiveAccess: { allowed: boolean; operationalStatus: string; commercialAccess: string }; lifecycle: string[] };
export type OrganizationParams = { page: number; pageSize: number; search?: string; operationalStatus?: string; lifecycle?: string[]; commercialAccess?: string[]; sort?: string };
export type OrganizationList = { data: Organization[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export const listOrganizations = (params: OrganizationParams) => httpClient.get<OrganizationList>('/platform/organizations', { params }).then((response) => response.data);

import { httpClient } from '@/shared/api/http';

export type ChargeCondition = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type ChargeNature = 'FIRST_PAYMENT' | 'RENEWAL' | 'ADJUSTMENT' | 'EXTRAORDINARY';
export type ChargeSettlement = {
  id: string;
  originalSettlementId: string | null;
  kind: 'RECEIPT' | 'REVERSAL';
  amount: string;
  receivedAt: string;
  effectiveAt: string | null;
  reason: string | null;
  provider: string | null;
  externalId: string | null;
  createdAt: string;
};
export type SubscriptionCharge = {
  id: string;
  commercialAccountId: string;
  subscriptionId: string;
  organizationId: string | null;
  amount: string;
  dueDate: string;
  nature: ChargeNature;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  provider: string | null;
  externalId: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  commercialAccount: { id: string; name: string };
  subscription: { id: string };
  organization: { id: string; name: string } | null;
  settlements: ChargeSettlement[];
  condition: ChargeCondition;
  paidAmount: string;
  outstandingAmount: string;
};
export type SubscriptionChargeParams = {
  commercialAccountId?: string;
  subscriptionId?: string;
  organizationId?: string;
  dueFrom?: string;
  dueTo?: string;
  condition?: ChargeCondition;
  nature?: ChargeNature;
  page: number;
  pageSize: number;
};
export type SubscriptionChargeList = { data: SubscriptionCharge[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type CreateSubscriptionChargeInput = {
  commercialAccountId: string;
  subscriptionId: string;
  organizationId?: string;
  amount: string;
  dueDate: string;
  nature: ChargeNature;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  provider?: string;
  externalId?: string;
};
export type UpdateSubscriptionChargeInput = { amount?: string; dueDate?: string; reason: string };

export const listSubscriptionCharges = (params: SubscriptionChargeParams) =>
  httpClient.get<SubscriptionChargeList>('/platform/subscription-charges', { params }).then((response) => response.data);
export const getSubscriptionCharge = (id: string) =>
  httpClient.get<SubscriptionCharge>(`/platform/subscription-charges/${id}`).then((response) => response.data);
export const createSubscriptionCharge = (input: CreateSubscriptionChargeInput) =>
  httpClient.post<SubscriptionCharge>('/platform/subscription-charges', input).then((response) => response.data);
export const updateSubscriptionCharge = (id: string, input: UpdateSubscriptionChargeInput) =>
  httpClient.patch<SubscriptionCharge>(`/platform/subscription-charges/${id}`, input).then((response) => response.data);
export const cancelSubscriptionCharge = (id: string) =>
  httpClient.post<SubscriptionCharge>(`/platform/subscription-charges/${id}/cancel`).then((response) => response.data);

import { httpClient } from '@/shared/api/http';

export type CommercialOrganization = { id: string; name: string; operationalStatus: string; createdAt: string };
export type PrimaryContact = { id: string; name: string; email: string; role: string; status: string; organizationId: string };
export type CommercialSubscription = { id: string; status: string; createdAt: string; migratedAt?: string | null; regularizedAt?: string | null; contractedPrice: string; contractedCurrency: string; contractedInterval: string; contractedOrganizationLimit: number | null; contractedUserLimit: number | null; contractedWorkOrderLimit: number | null; contractedGracePeriodDays: number; trial?: boolean; trialPeriod?: boolean; awaitingFirstPayment?: boolean; delinquent?: boolean; effectivelyCancelled?: boolean; pendingCommercialSetup?: boolean; commercialAccess?: string; effectiveAccess?: string; planVersion?: { id: string; version: number; plan: { id: string; name: string } } };
export type CommercialAccount = { id: string; name: string; billingEmail: string | null; billingDocument: string | null; primaryContact: PrimaryContact | null; missingPrimaryContact: boolean; organizations: CommercialOrganization[]; subscriptions: CommercialSubscription[]; createdAt: string; updatedAt: string };
export type CommercialAccountList = { data: CommercialAccount[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type CommercialAccountParams = { page: number; pageSize: number; search?: string };

export const listCommercialAccounts = (params: CommercialAccountParams) => httpClient.get<CommercialAccountList>('/platform/commercial-accounts', { params }).then((response) => response.data);
export const getCommercialAccount = (id: string) => httpClient.get<CommercialAccount>(`/platform/commercial-accounts/${id}`).then((response) => response.data);
export type SubscriptionCharge = { id: string; amount: string; condition: string; paidAmount: string; outstandingAmount: string; dueDate: string; settlements: Array<{ amount: string; kind: string }> };
export type ChargeList = { data: SubscriptionCharge[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export const listSubscriptionCharges = (commercialAccountId: string) => httpClient.get<ChargeList>('/platform/subscription-charges', { params: { commercialAccountId, page: 1, pageSize: 100 } }).then((response) => response.data);

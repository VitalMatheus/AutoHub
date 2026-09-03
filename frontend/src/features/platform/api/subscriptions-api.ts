import { httpClient } from '@/shared/api/http';

export type SubscriptionConditions = { pendingCommercialSetup: boolean; trial: boolean; awaitingFirstPayment: boolean; delinquent: boolean; paymentGracePeriod: boolean; scheduledCancellation: boolean; effectiveCancellation: boolean; commercialAccess: string };
export type Subscription = { id: string; commercialAccountId: string | null; planVersionId: string; status: string; contractedPrice: string; contractedCurrency: string; contractedInterval: string; contractedOrganizationLimit: number | null; contractedUserLimit: number | null; contractedWorkOrderLimit: number | null; contractedGracePeriodDays: number; migratedAt: string | null; regularizedAt: string | null; regularizationReason?: string | null; commercialStartAt: string | null; firstPaymentReceivedAt: string | null; firstPaidPeriodStartedAt?: string | null; trialEnabled?: boolean; trialStartsAt: string | null; trialEndsAt: string | null; currentPeriodStart?: string | null; currentPeriodEnd: string | null; cancellationRequestedAt: string | null; effectiveCancellationAt: string | null; createdAt: string; scheduledPlanVersionId: string | null; scheduledPlanEffectiveAt: string | null; scheduledPlanReason?: string | null; scheduledRecurringAdjustment: string | null; scheduledAdjustmentEffectiveAt: string | null; scheduledAdjustmentReason?: string | null; planVersion?: { id: string; version: number; plan: { id: string; name: string } }; commercialAccount?: { id: string; name: string }; conditions: SubscriptionConditions };
export type SubscriptionParams = { commercialAccountId?: string; status?: string; page: number; pageSize: number };
export type SubscriptionList = { data: Subscription[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export const listSubscriptions = (params: SubscriptionParams) => httpClient.get<SubscriptionList>('/platform/subscriptions', { params }).then((response) => response.data);
export const getSubscription = (id: string) => httpClient.get<Subscription>(`/platform/subscriptions/${id}`).then((response) => response.data);

export type RegularizeSubscriptionInput = { commercialStartAt: string; firstPaymentReceivedAt?: string; reason: string };
export type SchedulePlanChangeInput = { planVersionId: string; effectiveAt: string; reason: string };
export type ScheduleRecurringAdjustmentInput = { amount: string; effectiveAt: string; reason: string };
export type CancellationInput = { reason: string };

const postSubscriptionAction = <T>(id: string, action: string, input: T) => httpClient.post<Subscription>(`/platform/subscriptions/${id}/${action}`, input).then((response) => response.data);
export const regularizeSubscription = (id: string, input: RegularizeSubscriptionInput) => postSubscriptionAction(id, 'regularize', input);
export const schedulePlanChange = (id: string, input: SchedulePlanChangeInput) => postSubscriptionAction(id, 'plan-change', input);
export const scheduleRecurringAdjustment = (id: string, input: ScheduleRecurringAdjustmentInput) => postSubscriptionAction(id, 'recurring-price-adjustment', input);
export const requestSubscriptionCancellation = (id: string, input: CancellationInput) => postSubscriptionAction(id, 'cancel', input);
export const undoSubscriptionCancellation = (id: string, input: CancellationInput) => postSubscriptionAction(id, 'undo-cancellation', input);
export const cancelSubscriptionImmediately = (id: string, input: CancellationInput) => postSubscriptionAction(id, 'cancel-immediately', input);

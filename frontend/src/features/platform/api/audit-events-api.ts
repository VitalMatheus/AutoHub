import { httpClient } from '@/shared/api/http';

export const auditActions = [
  'commercial_account.created', 'organization.created', 'organization.updated', 'organization.activated', 'organization.deactivated', 'organization.suspended', 'organization.reactivated',
  'user.invitation_issued', 'user.activated', 'user.deactivated', 'plan.created', 'plan.updated', 'plan.archived', 'plan_version.created', 'plan_version.updated', 'plan_version.published',
  'subscription.created', 'subscription.migrated_regularized', 'subscription.plan_change_scheduled', 'subscription.recurring_adjustment_scheduled', 'subscription.plan_change_applied', 'subscription.recurring_adjustment_applied', 'subscription.cancellation_requested', 'subscription.cancellation_undone', 'subscription.cancelled', 'subscription.trial_exception_granted',
  'subscription_charge.created', 'subscription_charge.updated', 'subscription_charge.cancelled', 'charge_settlement.created', 'charge_settlement.reversed',
] as const;
export type AuditAction = (typeof auditActions)[number];
export type AuditTargetType = 'ORGANIZATION' | 'COMMERCIAL_ACCOUNT' | 'PLAN' | 'PLAN_VERSION' | 'SUBSCRIPTION' | 'SUBSCRIPTION_CHARGE' | 'CHARGE_SETTLEMENT' | 'USER';
export type AuditEvent = { id: string; occurredAt: string; actor: { type: 'USER' | 'SYSTEM'; userId: string | null; name: string | null; email: string | null }; action: AuditAction; target: { type: AuditTargetType; id: string }; reason: string | null; changes: { before: Record<string, unknown> | null; after: Record<string, unknown> | null } };
export type AuditEventsParams = { from?: string; to?: string; actor?: string; action?: AuditAction; targetType?: AuditTargetType; target?: string; cursor?: string; pageSize: number };
export type AuditEventsResponse = { data: AuditEvent[]; meta: { pageSize: number; hasNextPage: boolean; nextCursor: string | null } };

export const listAuditEvents = (params: AuditEventsParams) => httpClient.get<AuditEventsResponse>('/platform/audit-events', { params }).then((response) => response.data);

import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export enum AuditTargetType {
  ORGANIZATION = 'ORGANIZATION',
  COMMERCIAL_ACCOUNT = 'COMMERCIAL_ACCOUNT',
  PLAN = 'PLAN',
  PLAN_VERSION = 'PLAN_VERSION',
  SUBSCRIPTION = 'SUBSCRIPTION',
  SUBSCRIPTION_CHARGE = 'SUBSCRIPTION_CHARGE',
  CHARGE_SETTLEMENT = 'CHARGE_SETTLEMENT',
  USER = 'USER',
}

export enum AuditAction {
  COMMERCIAL_ACCOUNT_CREATED = 'commercial_account.created',
  ORGANIZATION_CREATED = 'organization.created', ORGANIZATION_UPDATED = 'organization.updated',
  ORGANIZATION_ACTIVATED = 'organization.activated', ORGANIZATION_DEACTIVATED = 'organization.deactivated', ORGANIZATION_SUSPENDED = 'organization.suspended', ORGANIZATION_REACTIVATED = 'organization.reactivated',
  USER_INVITATION_ISSUED = 'user.invitation_issued', USER_ACTIVATED = 'user.activated', USER_DEACTIVATED = 'user.deactivated',
  PLAN_CREATED = 'plan.created', PLAN_UPDATED = 'plan.updated', PLAN_ARCHIVED = 'plan.archived',
  PLAN_VERSION_CREATED = 'plan_version.created', PLAN_VERSION_UPDATED = 'plan_version.updated', PLAN_VERSION_PUBLISHED = 'plan_version.published',
  SUBSCRIPTION_CREATED = 'subscription.created', SUBSCRIPTION_MIGRATED_REGULARIZED = 'subscription.migrated_regularized', SUBSCRIPTION_PLAN_CHANGE_SCHEDULED = 'subscription.plan_change_scheduled', SUBSCRIPTION_RECURRING_ADJUSTMENT_SCHEDULED = 'subscription.recurring_adjustment_scheduled', SUBSCRIPTION_PLAN_CHANGE_APPLIED = 'subscription.plan_change_applied', SUBSCRIPTION_RECURRING_ADJUSTMENT_APPLIED = 'subscription.recurring_adjustment_applied', SUBSCRIPTION_CANCELLATION_REQUESTED = 'subscription.cancellation_requested', SUBSCRIPTION_CANCELLATION_UNDONE = 'subscription.cancellation_undone', SUBSCRIPTION_CANCELLED = 'subscription.cancelled', SUBSCRIPTION_TRIAL_EXCEPTION_GRANTED = 'subscription.trial_exception_granted',
  SUBSCRIPTION_CHARGE_CREATED = 'subscription_charge.created', SUBSCRIPTION_CHARGE_UPDATED = 'subscription_charge.updated', SUBSCRIPTION_CHARGE_CANCELLED = 'subscription_charge.cancelled',
  CHARGE_SETTLEMENT_CREATED = 'charge_settlement.created', CHARGE_ADMINISTRATIVELY_SETTLED = 'charge_settlement.administratively_settled', CHARGE_SETTLEMENT_REVERSED = 'charge_settlement.reversed',
}

export class ListAuditEventsDto {
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ description: 'User UUID or SYSTEM.' }) @IsOptional() @Matches(/^(SYSTEM|[0-9a-fA-F-]{36})$/) actor?: string;
  @ApiPropertyOptional({ enum: AuditAction }) @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @ApiPropertyOptional({ enum: AuditTargetType }) @IsOptional() @IsEnum(AuditTargetType) targetType?: AuditTargetType;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() target?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]+$/) cursor?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

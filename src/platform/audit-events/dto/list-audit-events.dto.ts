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
  ORGANIZATION_CREATED = 'organization.created', ORGANIZATION_UPDATED = 'organization.updated',
  ORGANIZATION_ACTIVATED = 'organization.activated', ORGANIZATION_DEACTIVATED = 'organization.deactivated',
  USER_INVITATION_ISSUED = 'user.invitation_issued',
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

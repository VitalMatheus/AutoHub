import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationOperationalStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum OrganizationLifecycleFilter {
  TRIAL = 'TRIAL',
  PAID_CURRENT = 'PAID_CURRENT',
  AWAITING_FIRST_PAYMENT = 'AWAITING_FIRST_PAYMENT',
  DELINQUENT = 'DELINQUENT',
  EFFECTIVELY_CANCELLED = 'EFFECTIVELY_CANCELLED',
  PENDING_COMMERCIAL_SETUP = 'PENDING_COMMERCIAL_SETUP',
}

export enum OrganizationCommercialAccessFilter {
  ACCESS_ALLOWED = 'ACCESS_ALLOWED',
  PAYMENT_GRACE_PERIOD = 'PAYMENT_GRACE_PERIOD',
  PAYMENT_BLOCKED = 'PAYMENT_BLOCKED',
}

export enum OrganizationSort {
  NAME_ASC = 'name',
  NAME_DESC = '-name',
  CREATED_AT_ASC = 'createdAt',
  CREATED_AT_DESC = '-createdAt',
  OPERATIONAL_STATUS_ASC = 'operationalStatus',
  OPERATIONAL_STATUS_DESC = '-operationalStatus',
}

export class ListOrganizationsDto {
  @ApiPropertyOptional({ description: 'Busca normalizada por Organization, Commercial Account ou Primary Contact.' })
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: OrganizationOperationalStatus })
  @IsOptional() @IsEnum(OrganizationOperationalStatus)
  operationalStatus?: OrganizationOperationalStatus;

  @ApiPropertyOptional({ enum: OrganizationLifecycleFilter, isArray: true })
  @IsOptional() @IsEnum(OrganizationLifecycleFilter, { each: true })
  lifecycle?: OrganizationLifecycleFilter[];

  @ApiPropertyOptional({ enum: OrganizationCommercialAccessFilter, isArray: true })
  @IsOptional() @IsEnum(OrganizationCommercialAccessFilter, { each: true })
  commercialAccess?: OrganizationCommercialAccessFilter[];

  @ApiPropertyOptional({ enum: OrganizationSort, default: '-createdAt' })
  @IsOptional() @IsEnum(OrganizationSort)
  sort?: OrganizationSort;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
}

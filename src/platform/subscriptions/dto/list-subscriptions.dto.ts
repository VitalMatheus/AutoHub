import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class ListSubscriptionsDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() commercialAccountId?: string;
  @ApiPropertyOptional({ enum: SubscriptionStatus }) @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @ApiPropertyOptional({ minimum: 1, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
}

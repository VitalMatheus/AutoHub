import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeMoneyTransform } from '../../../common/money/normalize-money';

export enum ChargeNatureDto { FIRST_PAYMENT='FIRST_PAYMENT', RENEWAL='RENEWAL', ADJUSTMENT='ADJUSTMENT', EXTRAORDINARY='EXTRAORDINARY' }
const decimal = /^\d+(\.\d{1,2})?$/;
export class CreateChargeDto {
  @ApiProperty({ format:'uuid' }) @IsUUID() commercialAccountId!: string;
  @ApiProperty({ format:'uuid' }) @IsUUID() subscriptionId!: string;
  @ApiPropertyOptional({ format:'uuid' }) @IsOptional() @IsUUID() organizationId?: string;
  @ApiProperty({ pattern:'^\\d+(\\.\\d{1,2})?$' }) @Transform(normalizeMoneyTransform) @Matches(decimal) amount!: string;
  @ApiProperty({ format:'date' }) @IsDateString() dueDate!: string;
  @ApiProperty({ enum: ChargeNatureDto }) @IsEnum(ChargeNatureDto) nature!: ChargeNatureDto;
  @ApiPropertyOptional({ format:'date' }) @IsOptional() @IsDateString() billingPeriodStart?: string;
  @ApiPropertyOptional({ format:'date' }) @IsOptional() @IsDateString() billingPeriodEnd?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provider?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() externalId?: string;
}

import { Transform, Type } from 'class-transformer';
import { IsDateString, IsDecimal, IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const decimal = /^\d+(\.\d{1,2})?$/;

export class ListExpensesDto {
  @ApiPropertyOptional({ enum: ['UNPAID', 'PARTIAL', 'PAID'] }) @IsOptional() @IsIn(['UNPAID', 'PARTIAL', 'PAID']) financialStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString() dueDateFrom?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString() dueDateTo?: string;
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsDecimal({ decimal_digits: '0,2' }) @Matches(decimal) minBalance?: string;
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsDecimal({ decimal_digits: '0,2' }) @Matches(decimal) maxBalance?: string;
  @ApiPropertyOptional({ enum: ['OPEN', 'CANCELLED'] }) @IsOptional() @IsIn(['OPEN', 'CANCELLED']) status?: 'OPEN' | 'CANCELLED';
  @ApiPropertyOptional({ enum: ['PARTS_AND_SUPPLIES', 'PERSONNEL', 'RENT', 'UTILITIES', 'TAXES', 'FINANCIAL_FEES', 'MAINTENANCE', 'MARKETING', 'OTHER'] }) @IsOptional() @IsIn(['PARTS_AND_SUPPLIES', 'PERSONNEL', 'RENT', 'UTILITIES', 'TAXES', 'FINANCIAL_FEES', 'MAINTENANCE', 'MARKETING', 'OTHER']) category?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() id?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === undefined ? value : Number(value)) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === undefined ? value : Number(value)) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

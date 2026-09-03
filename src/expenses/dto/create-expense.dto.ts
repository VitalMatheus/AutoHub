import { Transform } from 'class-transformer';
import { IsDateString, IsDecimal, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

const amount = /^(?=.*[1-9])\d+(\.\d{1,2})?$/;
const categories = ['PARTS_AND_SUPPLIES', 'PERSONNEL', 'RENT', 'UTILITIES', 'TAXES', 'FINANCIAL_FEES', 'MAINTENANCE', 'MARKETING', 'OTHER'] as const;

export class CreateExpenseDto {
  @ApiProperty({ enum: categories }) @IsIn(categories) category!: typeof categories[number];
  @ApiProperty({ example: 'Conta de energia' }) @IsString() @Length(1, 240) description!: string;
  @ApiProperty({ type: String, example: '350.90' }) @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(amount) amount!: string;
  @ApiProperty({ format: 'date', example: '2026-01-10' }) @IsDateString() dueDate!: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ enum: categories }) @IsOptional() @IsIn(categories) category?: typeof categories[number];
  @ApiPropertyOptional({ example: 'Conta de energia corrigida' }) @IsOptional() @IsString() @Length(1, 240) description?: string;
  @ApiPropertyOptional({ type: String, example: '350.90' }) @IsOptional() @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(amount) amount?: string;
  @ApiPropertyOptional({ format: 'date', example: '2026-01-10' }) @IsOptional() @IsDateString() dueDate?: string;
}

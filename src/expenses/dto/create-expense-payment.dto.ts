import { Transform } from 'class-transformer';
import { IsDateString, IsDecimal, IsIn, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

const amount = /^(?=.*[1-9])\d+(\.\d{1,2})?$/;

export class CreateExpensePaymentDto {
  @ApiProperty({ type: String, example: '100.00' }) @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(amount) amount!: string;
  @ApiProperty({ enum: ['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER'] }) @IsIn(['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER']) method!: 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
  @ApiPropertyOptional({ enum: ['PENDING', 'CONFIRMED'], default: 'CONFIRMED' }) @IsOptional() @IsIn(['PENDING', 'CONFIRMED']) status?: 'PENDING' | 'CONFIRMED';
  @ApiPropertyOptional({ format: 'date-time', description: 'Data da baixa. Obrigatória para uma baixa confirmada.' }) @IsOptional() @IsDateString() paidAt?: string;
}

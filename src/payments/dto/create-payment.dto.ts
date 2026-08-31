import { IsDateString, IsDecimal, IsIn, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

const amount = /^(?=.*[1-9])\d+(\.\d{1,2})?$/;

export class CreatePaymentDto {
  @ApiProperty({ type: String, pattern: '^\\d+(\\.\\d{1,2})?$', example: '149.90', description: 'Decimal money value serialized as a string.' })
  @Transform(normalizeMoneyTransform)
  @IsDecimal({ decimal_digits: '0,2' })
  @Matches(amount)
  amount!: string;

  @ApiProperty({ enum: ['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER'] })
  @IsIn(['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER'])
  method!: 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'OTHER';

  @ApiPropertyOptional({ enum: ['PENDING', 'CONFIRMED'], default: 'CONFIRMED' })
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED'])
  status?: 'PENDING' | 'CONFIRMED';

  @ApiProperty({ format: 'date-time', example: '2026-01-01T10:00:00.000Z' })
  @IsDateString()
  paidAt!: string;
}

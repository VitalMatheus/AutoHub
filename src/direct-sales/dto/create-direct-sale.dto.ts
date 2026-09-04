import { Transform } from 'class-transformer';
import { IsArray, IsDecimal, IsIn, IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

const money = /^(?=.*[1-9])\d+(\.\d{1,2})?$/;
const nonNegativeMoney = /^\d+(\.\d{1,2})?$/;
export class DirectSaleItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId!: string;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) quantity!: number;
  @ApiProperty({ example: '99.90' }) @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(money) unitPrice!: string;
  @ApiPropertyOptional({ example: '0.00' }) @IsOptional() @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(nonNegativeMoney) discount?: string;
}

export class CreateDirectSaleDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() customerId?: string;
  @ApiProperty({ type: [DirectSaleItemDto] }) @IsArray() items!: DirectSaleItemDto[];
}

export class UpdateDirectSaleDto extends CreateDirectSaleDto {}

export class SalePaymentDto {
  @ApiProperty({ example: '50.00' }) @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(money) amount!: string;
  @ApiProperty({ enum: ['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER'] }) @IsIn(['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER']) method!: 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
  @ApiPropertyOptional({ enum: ['PENDING', 'CONFIRMED'], default: 'CONFIRMED' }) @IsOptional() @IsIn(['PENDING', 'CONFIRMED']) status?: 'PENDING' | 'CONFIRMED';
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() paidAt?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() installmentDueDate?: string;
}

export class ConfirmDirectSaleDto {
  @ApiPropertyOptional({ type: [SalePaymentDto] }) @IsOptional() @IsArray() payments?: SalePaymentDto[];
}

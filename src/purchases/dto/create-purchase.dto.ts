import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, IsDecimal, Matches, Min, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

const money = /^(?=.*[1-9])\d+(\.\d{1,2})?$/;
export class PurchaseItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId!: string;
  @ApiProperty({ example: 2 }) @IsInt() @Min(1) quantity!: number;
  @ApiProperty({ type: String, example: '45.90' }) @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(money) unitCost!: string;
  @ApiPropertyOptional({ example: 90 }) @IsOptional() @IsInt() @Min(0) warrantyDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) batchNumber?: string;
}

export class CreatePurchaseDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() supplierId!: string;
  @ApiProperty({ format: 'date' }) @IsDateString() purchaseDate!: string;
  @ApiProperty({ format: 'date' }) @IsDateString() dueDate!: string;
  @ApiProperty({ type: [PurchaseItemDto] }) @IsArray() items!: PurchaseItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 80) documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500) notes?: string;
}

export class UpdatePurchaseDto extends CreatePurchaseDto {}

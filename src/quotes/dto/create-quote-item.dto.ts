import { IsDecimal, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

const decimal = /^\d+(\.\d{1,3})?$/;

export class CreateQuoteItemDto {
  @ApiProperty({ enum: ['SERVICE', 'PRODUCT', 'MANUAL'] })
  @IsIn(['SERVICE', 'PRODUCT', 'MANUAL']) type!: 'SERVICE' | 'PRODUCT' | 'MANUAL';
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() serviceId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional()
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @ApiProperty({ type: String, pattern: '^\\d+(\\.\\d{1,3})?$', example: '1.500' })
  @IsDecimal({ decimal_digits: '1,3' }) @Matches(decimal) quantity!: string;
  @ApiPropertyOptional({ type: String, pattern: '^\\d+(\\.\\d{1,2})?$', example: '149.90', description: 'Aceita entrada brasileira com vírgula, como 149,90.' })
  @IsOptional() @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(/^\d+(\.\d{1,2})?$/) unitPrice?: string;
}

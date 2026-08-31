import { Transform } from 'class-transformer';
import { IsDecimal, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

export class UpdateProductDto {
  @IsOptional() @IsString() @Length(1, 160)
  name?: string;

  @IsOptional() @IsString() @Length(1, 2000)
  description?: string;

  @IsOptional() @IsString() @Length(1, 80) @Matches(/\S/)
  sku?: string;

  @IsOptional() @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' })
  salePrice?: string;

  @IsOptional() @IsInt() @Min(0)
  stockQuantity?: number;

  @IsOptional() @IsInt() @Min(0)
  stockMinimum?: number;
}

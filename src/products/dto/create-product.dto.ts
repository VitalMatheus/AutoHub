import { Transform } from 'class-transformer';
import { IsDecimal, IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

export class CreateProductDto {
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @IsOptional() @IsString() @Length(1, 2000)
  description?: string;

  @IsOptional() @IsString() @Length(1, 80)
  sku?: string;

  @Transform(normalizeMoneyTransform)
  @IsDecimal({ decimal_digits: '0,2' })
  salePrice!: string;

  @IsOptional() @IsInt() @Min(0)
  stockQuantity = 0;

  @IsOptional() @IsInt() @Min(0)
  stockMinimum = 0;
}

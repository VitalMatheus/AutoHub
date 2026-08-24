import { IsDecimal, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateProductDto {
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @IsOptional() @IsString() @Length(1, 2000)
  description?: string;

  @IsOptional() @IsString() @Length(1, 80)
  sku?: string;

  @IsDecimal({ decimal_digits: '0,2' })
  salePrice!: string;
}

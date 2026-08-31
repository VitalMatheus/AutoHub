import { Transform } from 'class-transformer';
import { IsDecimal, IsOptional, IsString, Length } from 'class-validator';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

export class UpdateServiceDto {
  @IsOptional() @IsString() @Length(1, 160)
  name?: string;

  @IsOptional() @IsString() @Length(1, 2000)
  description?: string;

  @IsOptional() @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' })
  price?: string;
}

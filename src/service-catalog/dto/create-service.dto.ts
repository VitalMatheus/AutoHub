import { Transform } from 'class-transformer';
import { IsDecimal, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

export class CreateServiceDto {
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @IsOptional() @IsString() @Length(1, 2000)
  description?: string;

  @Transform(normalizeMoneyTransform)
  @IsDecimal({ decimal_digits: '0,2' })
  price!: string;
}

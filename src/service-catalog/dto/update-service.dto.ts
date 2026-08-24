import { IsDecimal, IsOptional, IsString, Length } from 'class-validator';

export class UpdateServiceDto {
  @IsOptional() @IsString() @Length(1, 160)
  name?: string;

  @IsOptional() @IsString() @Length(1, 2000)
  description?: string;

  @IsOptional() @IsDecimal({ decimal_digits: '0,2' })
  price?: string;
}

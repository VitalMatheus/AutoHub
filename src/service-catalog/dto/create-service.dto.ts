import { IsDecimal, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateServiceDto {
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @IsOptional() @IsString() @Length(1, 2000)
  description?: string;

  @IsDecimal({ decimal_digits: '0,2' })
  price!: string;
}

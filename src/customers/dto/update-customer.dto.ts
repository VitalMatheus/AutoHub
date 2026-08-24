import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional() @IsString() @Length(1, 160)
  name?: string;

  @IsOptional() @IsString() @Length(1, 20)
  document?: string;

  @IsOptional() @IsString() @Length(1, 30)
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @Length(1, 2000)
  notes?: string;
}

import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateCustomerDto {
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @IsOptional() @IsString() @Length(1, 20)
  document?: string;

  @IsString() @IsNotEmpty() @Length(1, 30)
  phone!: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @Length(1, 2000)
  notes?: string;
}

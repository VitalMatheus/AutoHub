import { IsEmail, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;
}

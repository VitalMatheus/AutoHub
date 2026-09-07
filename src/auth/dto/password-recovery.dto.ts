import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 32, writeOnly: true })
  @IsString()
  @MinLength(32)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, format: 'password', writeOnly: true })
  @IsString()
  @Length(12, 128)
  password!: string;
}

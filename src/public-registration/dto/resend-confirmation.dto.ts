import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ResendConfirmationDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: false, writeOnly: true })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

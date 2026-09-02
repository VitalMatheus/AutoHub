import { IsEmail, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@oficina.example' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'correct horse battery staple', minLength: 12, maxLength: 128, format: 'password' })
  @IsString()
  @Length(12, 128)
  password!: string;
}

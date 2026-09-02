import { IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateDto {
  @ApiProperty({ example: 'activation-token-returned-on-invitation', minLength: 32 })
  @IsString() @MinLength(32)
  token!: string;

  @ApiProperty({ example: 'correct horse battery staple', minLength: 12, maxLength: 128, format: 'password' })
  @IsString() @Length(12, 128)
  password!: string;
}

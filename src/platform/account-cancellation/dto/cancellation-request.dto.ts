import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CancellationRequestDto {
  @ApiProperty({ minLength: 12, maxLength: 128, format: 'password' })
  @IsString()
  @IsNotEmpty()
  @Length(12, 128)
  password!: string;
}

export class CancellationConfirmationDto {
  @ApiProperty({ description: 'Single-use token received by e-mail.' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

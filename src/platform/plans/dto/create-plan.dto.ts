import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'BASIC', required: false, pattern: '^[A-Z][A-Z0-9_]*$', description: 'Stable identifier used by integrations and internal commercial flows.' })
  @IsOptional() @IsString() @IsNotEmpty() @Length(1, 80) @Matches(/^[A-Z][A-Z0-9_]*$/)
  code?: string;

  @ApiProperty({ example: 'Vekar Básico' })
  @IsString() @IsNotEmpty() @Length(1, 120)
  name!: string;
}

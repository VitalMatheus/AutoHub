import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'AutoHub Básico' })
  @IsString() @IsNotEmpty() @Length(1, 120)
  name!: string;
}

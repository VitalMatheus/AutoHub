import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CancellationDto {
  @ApiProperty({ description: 'Business reason preserved in the append-only audit event.' })
  @IsString() @IsNotEmpty() @Length(3, 500) reason!: string;
}

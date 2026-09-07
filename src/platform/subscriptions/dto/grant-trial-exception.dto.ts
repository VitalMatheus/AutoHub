import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class GrantTrialExceptionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  commercialAccountId!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  planVersionId!: string;

  @ApiProperty({ format: 'date-time', description: 'Instant at which the exceptional Trial Period starts.' }) @IsDateString()
  trialStartsAt!: string;

  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Required business reason; it is preserved in the immutable Audit Event.' })
  @IsString() @IsNotEmpty() @Length(3, 500)
  reason!: string;
}

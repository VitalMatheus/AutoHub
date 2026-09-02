import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class SchedulePlanChangeDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() planVersionId!: string;
  @ApiProperty({ format: 'date-time', description: 'Future renewal at which the new version becomes effective.' }) @IsDateString() effectiveAt!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @Length(3, 500) reason!: string;
}

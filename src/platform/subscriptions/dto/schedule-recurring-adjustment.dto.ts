import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { normalizeMoneyTransform } from '../../../common/money/normalize-money';

export class ScheduleRecurringAdjustmentDto {
  @ApiProperty({ example: '-10.00', description: 'Fixed recurring delta; may be negative but never makes Contracted Price negative.' })
  @Transform(normalizeMoneyTransform) @IsString() @Matches(/^-?\d+(\.\d{1,2})?$/) amount!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() effectiveAt!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @Length(3, 500) reason!: string;
}

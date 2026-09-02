import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeMoneyTransform } from '../../../common/money/normalize-money';
export class UpdateChargeDto {
  @ApiPropertyOptional({ pattern:'^\\d+(\\.\\d{1,2})?$' }) @IsOptional() @Transform(normalizeMoneyTransform) @Matches(/^\d+(\.\d{1,2})?$/) amount?: string;
  @ApiPropertyOptional({ format:'date' }) @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsString() @MinLength(1) reason!: string;
}

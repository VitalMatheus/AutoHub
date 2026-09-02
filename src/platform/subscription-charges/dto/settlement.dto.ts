import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeMoneyTransform } from '../../../common/money/normalize-money';
export class CreateSettlementDto {
  @ApiProperty({ pattern:'^\\d+(\\.\\d{1,2})?$' }) @Transform(normalizeMoneyTransform) @Matches(/^\d+(\.\d{1,2})?$/) amount!: string;
  @ApiProperty({ format:'date-time' }) @IsDateString() receivedAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provider?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() externalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) reason?: string;
}
export class ReverseSettlementDto {
  @ApiProperty() @IsString() @MinLength(1) reason!: string;
  @ApiPropertyOptional({ format:'date-time' }) @IsOptional() @IsDateString() effectiveAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provider?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() externalId?: string;
}

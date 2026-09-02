import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() commercialAccountId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() planVersionId!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() trialEnabled = true;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() trialStartsAt?: string;
}

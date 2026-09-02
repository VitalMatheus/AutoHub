import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() commercialAccountId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() planVersionId!: string;
  @ApiPropertyOptional({ description: 'Defaults to true only for the first Subscription of the Commercial Account.' }) @IsOptional() @IsBoolean() trialEnabled?: boolean;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() trialStartsAt?: string;
  @ApiPropertyOptional({ description: 'Required when explicitly granting a new Trial after a previous Subscription ended.' }) @IsOptional() @IsString() @Length(3, 500) trialExceptionReason?: string;
}

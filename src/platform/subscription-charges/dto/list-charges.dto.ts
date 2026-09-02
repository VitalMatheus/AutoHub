import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ChargeNatureDto } from './create-charge.dto';
export enum ChargeConditionDto { PENDING='PENDING', PARTIALLY_PAID='PARTIALLY_PAID', PAID='PAID', OVERDUE='OVERDUE', CANCELLED='CANCELLED' }
export class ListChargesDto {
 @ApiPropertyOptional() @IsOptional() @IsUUID() commercialAccountId?: string;
 @ApiPropertyOptional() @IsOptional() @IsUUID() subscriptionId?: string;
 @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string;
 @ApiPropertyOptional({format:'date'}) @IsOptional() @IsDateString() dueFrom?: string;
 @ApiPropertyOptional({format:'date'}) @IsOptional() @IsDateString() dueTo?: string;
 @ApiPropertyOptional({enum:ChargeConditionDto}) @IsOptional() @IsEnum(ChargeConditionDto) condition?: ChargeConditionDto;
 @ApiPropertyOptional({enum:ChargeNatureDto}) @IsOptional() @IsEnum(ChargeNatureDto) nature?: ChargeNatureDto;
 @ApiPropertyOptional({minimum:1,maximum:100}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=20;
 @ApiPropertyOptional({minimum:1}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page=1;
}

import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class ListPurchasesDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'] }) @IsOptional() @IsIn(['DRAFT', 'CONFIRMED', 'CANCELLED']) status?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() supplierId?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString() purchaseDateFrom?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString() purchaseDateTo?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

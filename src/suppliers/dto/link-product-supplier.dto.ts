import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDecimal, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';
export class LinkProductSupplierDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) externalCode?: string;
  @ApiPropertyOptional({ example: '99.90', type: String }) @IsOptional() @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) lastCost?: string;
  @ApiPropertyOptional({ example: 365, description: 'Prazo padrão de garantia em dias.' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) warrantyDays?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() preferred?: boolean;
}

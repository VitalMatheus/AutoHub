import { IsInt, IsNotIn, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({ description: 'Variação inteira do estoque; negativa reduz o saldo.', example: -2 })
  @IsInt() @Min(-1000000) @Max(1000000) @IsNotIn([0]) quantityChange!: number;

  @ApiPropertyOptional({ description: 'Motivo da correção explícita.' })
  @IsOptional() @IsString() @Length(1, 500) note?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ManagerialReportQueryDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-09-01', description: 'Início inclusivo do período (America/Recife).' })
  @IsOptional() @IsDateString() from?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-09-30', description: 'Fim inclusivo do período (America/Recife).' })
  @IsOptional() @IsDateString() to?: string;
}

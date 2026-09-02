import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Reference instant for the snapshot.' })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({ example: '2025-01', description: 'First civil month in the historical series (inclusive).' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  from?: string;

  @ApiPropertyOptional({ example: '2025-12', description: 'Last civil month in the historical series (inclusive). Maximum interval: 24 months.' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  to?: string;
}

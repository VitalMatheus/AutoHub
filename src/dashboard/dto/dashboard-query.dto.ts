import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Reference instant for the snapshot.' })
  @IsOptional()
  @IsDateString()
  asOf?: string;
}

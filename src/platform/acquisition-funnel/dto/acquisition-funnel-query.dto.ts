import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AcquisitionFunnelQueryDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Inclusive start of the reporting window.' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Exclusive end of the reporting window.' })
  @IsOptional() @IsDateString()
  to?: string;
}

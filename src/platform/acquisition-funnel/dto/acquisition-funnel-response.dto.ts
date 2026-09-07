import { ApiProperty } from '@nestjs/swagger';
import { AcquisitionFunnelStage } from '@prisma/client';

export class AcquisitionFunnelStageDto {
  @ApiProperty({ enum: AcquisitionFunnelStage }) stage!: AcquisitionFunnelStage;
  @ApiProperty({ description: 'Number of distinct keyed pseudonymous subjects.' }) uniqueSubjects!: number;
  @ApiProperty({ description: 'Stage count divided by registration starts, from 0 to 1.' }) conversionRate!: number;
}

export class AcquisitionFunnelResponseDto {
  @ApiProperty({ format: 'date-time' }) asOf!: Date;
  @ApiProperty({ type: [AcquisitionFunnelStageDto] }) stages!: AcquisitionFunnelStageDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TrialStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'EXPIRED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() remainingDays!: number;
  @ApiProperty() message!: string;
}

class WorkshopMetricDto {
  @ApiProperty() customers!: number;
  @ApiProperty() vehicles!: number;
  @ApiProperty() quotes!: number;
  @ApiProperty() workOrders!: number;
}

class WorkshopActivityDto {
  @ApiProperty() type!: string;
  @ApiProperty() label!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty() href!: string;
}

export class WorkshopDashboardResponseDto {
  @ApiProperty({ format: 'date-time' }) referenceAt!: string;
  @ApiProperty({ example: 'America/Recife' }) timezone!: string;
  @ApiProperty() organization!: { id: string; name: string };
  @ApiPropertyOptional({ type: TrialStatusDto, nullable: true }) trial!: TrialStatusDto | null;
  @ApiProperty({ type: WorkshopMetricDto }) metrics!: WorkshopMetricDto;
  @ApiProperty({ type: [WorkshopActivityDto] }) activities!: WorkshopActivityDto[];
}

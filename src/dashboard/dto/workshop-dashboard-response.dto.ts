import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TrialStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'EXPIRED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() remainingDays!: number;
  @ApiProperty() message!: string;
}

class WorkshopChecklistItemDto {
  @ApiProperty({ enum: ['WORKSHOP_DETAILS', 'FIRST_CUSTOMER', 'FIRST_VEHICLE', 'FIRST_QUOTE', 'FIRST_WORK_ORDER', 'FIRST_FINANCE_RECORD'] }) key!: string;
  @ApiProperty() label!: string;
  @ApiProperty() completed!: boolean;
  @ApiProperty() href!: string;
}

export class WorkshopDashboardResponseDto {
  @ApiProperty({ format: 'date-time' }) referenceAt!: string;
  @ApiProperty({ example: 'America/Recife' }) timezone!: string;
  @ApiProperty() organization!: { id: string; name: string };
  @ApiPropertyOptional({ type: TrialStatusDto, nullable: true }) trial!: TrialStatusDto | null;
  @ApiProperty({ type: [WorkshopChecklistItemDto] }) checklist!: WorkshopChecklistItemDto[];
}

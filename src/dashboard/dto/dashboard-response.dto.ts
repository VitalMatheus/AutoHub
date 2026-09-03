import { ApiProperty } from '@nestjs/swagger';

class OrganizationMetricsDto {
  @ApiProperty() total!: number;
  @ApiProperty() current!: number;
  @ApiProperty() dueSoon!: number;
  @ApiProperty() overdue!: number;
  @ApiProperty() paymentBlocked!: number;
  @ApiProperty({ description: 'Organizations suspended administratively, independent of payment.' }) suspended!: number;
}

class FinancialMetricsDto {
  @ApiProperty({ description: 'Cash-basis receipts in the reference civil month.', example: '149.90' }) receivedRevenue!: string;
  @ApiProperty({ description: 'Open amount due today or in the future.', example: '149.90' }) openWithinDue!: string;
  @ApiProperty({ description: 'Open amount past its due date.', example: '149.90' }) overdue!: string;
}

class AttentionOrganizationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [String], example: ['OVERDUE'] }) reasons!: string[];
}

export class DashboardResponseDto {
  @ApiProperty({ format: 'date-time' }) referenceAt!: string;
  @ApiProperty({ example: 'America/Recife' }) timezone!: string;
  @ApiProperty({ type: OrganizationMetricsDto }) organizations!: OrganizationMetricsDto;
  @ApiProperty({ type: FinancialMetricsDto }) financial!: FinancialMetricsDto;
  @ApiProperty({ type: [AttentionOrganizationDto], maxItems: 5 }) attentionOrganizations!: AttentionOrganizationDto[];
}

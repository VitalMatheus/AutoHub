import { ApiProperty } from '@nestjs/swagger';

class OrganizationMetricsDto {
  @ApiProperty() total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() inactive!: number;
  @ApiProperty() suspended!: number;
  @ApiProperty({ description: 'Organizations blocked by commercial access, independent of operational status.' }) commerciallyBlocked!: number;
}

class SubscriptionMetricsDto {
  @ApiProperty() trial!: number;
  @ApiProperty() paidCurrent!: number;
  @ApiProperty() awaitingFirstPayment!: number;
  @ApiProperty() delinquent!: number;
  @ApiProperty() effectivelyCancelled!: number;
  @ApiProperty() pendingCommercialSetup!: number;
}

class MonthlyMetricsDto {
  @ApiProperty() newOrganizations!: number;
  @ApiProperty() newCommercialAccounts!: number;
  @ApiProperty() effectiveCancellations!: number;
  @ApiProperty() operationalDeactivations!: number;
}

class PendingRevenueDto {
  @ApiProperty({ description: 'Decimal monetary value serialized as a string.', example: '149.90' }) upcoming!: string;
  @ApiProperty({ description: 'Decimal monetary value serialized as a string.', example: '149.90' }) overdue!: string;
  @ApiProperty({ description: 'Decimal monetary value serialized as a string.', example: '299.80' }) total!: string;
}

class FinancialMetricsDto {
  @ApiProperty({ description: 'Decimal monetary value serialized as a string.', example: '149.90' }) mrr!: string;
  @ApiProperty({ description: 'Cash-basis revenue as a decimal string.', example: '149.90' }) receivedRevenue!: string;
  @ApiProperty({ type: PendingRevenueDto }) pendingRevenue!: PendingRevenueDto;
}

class HistoricalMonthDto {
  @ApiProperty({ example: '2026-01' }) month!: string;
  @ApiProperty({ description: 'MRR at the civil month closing, or asOf for the current month.', example: '149.90' }) mrr!: string;
  @ApiProperty({ example: 3 }) organizations!: number;
  @ApiProperty({ description: 'Cash-basis receipts minus effective reversals.', example: '149.90' }) receivedRevenue!: string;
  @ApiProperty() newOrganizations!: number;
  @ApiProperty() newCommercialAccounts!: number;
  @ApiProperty() effectiveCancellations!: number;
  @ApiProperty() operationalDeactivations!: number;
}

export class DashboardResponseDto {
  @ApiProperty({ format: 'date-time' }) referenceAt!: string;
  @ApiProperty({ example: 'America/Recife' }) timezone!: string;
  @ApiProperty({ type: OrganizationMetricsDto }) organizations!: OrganizationMetricsDto;
  @ApiProperty({ type: SubscriptionMetricsDto }) subscriptions!: SubscriptionMetricsDto;
  @ApiProperty({ type: MonthlyMetricsDto }) monthly!: MonthlyMetricsDto;
  @ApiProperty({ type: FinancialMetricsDto }) financial!: FinancialMetricsDto;
  @ApiProperty({ type: [HistoricalMonthDto] }) series!: HistoricalMonthDto[];
}

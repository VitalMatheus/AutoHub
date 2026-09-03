import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountSubscriptionChargeResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subscriptionId!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ type: 'string', pattern: '^\\d+\\.\\d{2}$' }) amount!: string;
  @ApiProperty({ format: 'date' }) dueDate!: string;
  @ApiProperty({ enum: ['FIRST_PAYMENT', 'RENEWAL'] }) nature!: string;
  @ApiPropertyOptional({ format: 'date', nullable: true }) billingPeriodStart!: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true }) billingPeriodEnd!: string | null;
  @ApiProperty({ enum: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'] }) condition!: string;
  @ApiProperty({ type: 'string', pattern: '^\\d+\\.\\d{2}$' }) paidAmount!: string;
  @ApiProperty({ type: 'string', pattern: '^\\d+\\.\\d{2}$' }) outstandingAmount!: string;
}

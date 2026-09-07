import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmCardCheckoutDto {
  @ApiProperty({ description: 'Confirms the displayed Basic Plan conditions.' })
  @IsBoolean()
  confirmed!: boolean;

  @ApiPropertyOptional({ description: 'Explicitly authorizes future automatic card renewals.' })
  @IsOptional()
  @IsBoolean()
  authorizeRenewal = false;
}

export class CardCheckoutResponseDto {
  @ApiProperty() attemptId!: string;
  @ApiProperty({ enum: ['INITIAL', 'RENEWAL'] }) kind!: string;
  @ApiProperty({ enum: ['PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'REVERSED'] }) status!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional({ nullable: true }) checkoutUrl!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) expiresAt!: string | null;
  @ApiProperty() renewalAuthorized!: boolean;
  @ApiPropertyOptional({ nullable: true }) failureReason!: string | null;
}

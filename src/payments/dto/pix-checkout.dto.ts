import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ConfirmPixCheckoutDto {
  @ApiProperty({ description: 'Explicitly confirms the displayed Basic Plan conditions.' })
  @IsBoolean()
  confirmed!: boolean;
}

export class PixCheckoutResponseDto {
  @ApiProperty() attemptId!: string;
  @ApiProperty({ enum: ['PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'REVERSED'] }) status!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() planName!: string;
  @ApiProperty() planPrice!: string;
  @ApiProperty() interval!: string;
  @ApiProperty() billingDay!: number;
  @ApiPropertyOptional({ nullable: true }) qrCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) copyPasteCode!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) expiresAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) failureReason!: string | null;
}

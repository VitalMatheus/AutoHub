import { ApiProperty } from '@nestjs/swagger';

export class ReconcileResponseDto {
  @ApiProperty() created!: number;
  @ApiProperty({ type: [String], format: 'uuid' }) chargeIds!: string[];
  @ApiProperty({ example: { scheduled: 3, sent: 1, skipped: 0 } }) reminders!: { scheduled: number; sent: number; skipped: number };
}

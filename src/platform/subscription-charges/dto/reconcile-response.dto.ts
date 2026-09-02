import { ApiProperty } from '@nestjs/swagger';

export class ReconcileResponseDto {
  @ApiProperty() created!: number;
  @ApiProperty({ type: [String], format: 'uuid' }) chargeIds!: string[];
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Matches, Max, Min } from 'class-validator';

export class RegularizeCommercialSetupDto {
  @ApiProperty({ type: 'string', pattern: '^\\d+\\.\\d{2}$', example: '79.00' })
  @Matches(/^\d+\.\d{2}$/)
  contractedPrice!: string;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-10-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  firstDueDate!: string;

  @ApiProperty({ minimum: 1, maximum: 28, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  billingDay!: number;
}

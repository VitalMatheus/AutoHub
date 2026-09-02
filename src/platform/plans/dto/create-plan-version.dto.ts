import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { normalizeMoneyTransform } from '../../../common/money/normalize-money';

export enum PlanInterval { MONTHLY = 'MONTHLY' }

export class CreatePlanVersionDto {
  @ApiProperty({ example: '79.00', pattern: '^\\d+(\\.\\d{1,2})?$' })
  @Transform(normalizeMoneyTransform) @IsString() @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;

  @ApiPropertyOptional({ default: 'BRL', example: 'BRL' })
  @IsOptional() @IsString() @Length(3, 3) @Matches(/^[A-Z]{3}$/)
  currency = 'BRL';

  @ApiPropertyOptional({ enum: PlanInterval, default: PlanInterval.MONTHLY })
  @IsOptional() @IsEnum(PlanInterval)
  interval = PlanInterval.MONTHLY;

  @ApiProperty({ example: 1 }) @Type(() => Number) @IsInt() @Min(1)
  organizationLimit!: number;
  @ApiProperty({ example: 3 }) @Type(() => Number) @IsInt() @Min(1)
  userLimit!: number;
  @ApiPropertyOptional({ example: null, nullable: true }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  workOrderLimit?: number | null;
  @ApiPropertyOptional({ default: 5 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  gracePeriodDays = 5;
}

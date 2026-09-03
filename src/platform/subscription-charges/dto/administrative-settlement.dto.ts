import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeMoneyTransform } from '../../../common/money/normalize-money';

export enum AdministrativeSettlementMethodDto {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  CHECK = 'CHECK',
  OTHER = 'OTHER',
}

export class AdministrativeSettlementDto {
  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,2})?$' })
  @Transform(normalizeMoneyTransform)
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({ enum: AdministrativeSettlementMethodDto })
  @IsEnum(AdministrativeSettlementMethodDto)
  method!: AdministrativeSettlementMethodDto;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  effectiveAt!: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  reason!: string;
}

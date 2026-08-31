import { IsDecimal, IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeMoneyTransform } from '../../common/money/normalize-money';

export class UpdateWorkOrderItemDto {
  @IsOptional() @IsIn(['SERVICE', 'PRODUCT', 'MANUAL']) type?: 'SERVICE' | 'PRODUCT' | 'MANUAL';
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '1,3' }) @Matches(/^\d+(\.\d{1,3})?$/) quantity?: string;
  @IsOptional() @Transform(normalizeMoneyTransform) @IsDecimal({ decimal_digits: '0,2' }) @Matches(/^\d+(\.\d{1,2})?$/) unitPrice?: string;
}

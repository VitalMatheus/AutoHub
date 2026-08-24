import { IsDecimal, IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class UpdateQuoteItemDto {
  @IsOptional() @IsIn(['SERVICE', 'PRODUCT', 'MANUAL']) type?: 'SERVICE' | 'PRODUCT' | 'MANUAL';
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '1,3' }) @Matches(/^\d+(\.\d{1,3})?$/) quantity?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2' }) @Matches(/^\d+(\.\d{1,2})?$/) unitPrice?: string;
}

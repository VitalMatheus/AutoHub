import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AsaasWebhookPaymentDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() externalReference!: string;
  @ApiProperty() value!: number | string;
  @ApiProperty() @IsString() billingType!: string;
  @ApiProperty() @IsString() status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
}

export class AsaasWebhookDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() @IsIn(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK']) event!: string;
  @ApiProperty({ type: AsaasWebhookPaymentDto }) @ValidateNested() @Type(() => AsaasWebhookPaymentDto) payment!: AsaasWebhookPaymentDto;
}

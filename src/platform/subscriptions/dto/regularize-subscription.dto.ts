import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class RegularizeSubscriptionDto {
  @ApiProperty({ format: 'date-time' }) @IsDateString() commercialStartAt!: string;
  @ApiProperty({ format: 'date-time', required: false, description: 'Confirmação explícita do primeiro pagamento; não cria Charge.' })
  @IsOptional() @IsDateString() firstPaymentReceivedAt?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @Length(3, 500) reason!: string;
}

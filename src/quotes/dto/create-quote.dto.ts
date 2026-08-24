import { IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateQuoteDto {
  @IsUUID() customerId!: string;
  @IsUUID() vehicleId!: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}

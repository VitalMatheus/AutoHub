import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateQuoteDto {
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}

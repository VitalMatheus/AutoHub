import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional() @IsUUID()
  customerId?: string;

  @IsOptional() @IsString() @Length(1, 12)
  plate?: string;

  @IsOptional() @IsString() @Length(1, 80)
  brand?: string;

  @IsOptional() @IsString() @Length(1, 80)
  model?: string;

  @IsOptional() @IsInt() @Min(1886) @Max(2500)
  year?: number;

  @IsOptional() @IsString() @Length(1, 40)
  color?: string;

  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647)
  mileage?: number;

  @IsOptional() @IsString() @Length(1, 2000)
  notes?: string;
}

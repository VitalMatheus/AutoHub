import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class UpdateWorkOrderDto {
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsString() @Length(1, 4000) reportedProblem?: string;
  @IsOptional() @IsString() @Length(1, 4000) diagnosis?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) mileage?: number;
  @IsOptional() @IsDateString() expectedCompletionDate?: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}

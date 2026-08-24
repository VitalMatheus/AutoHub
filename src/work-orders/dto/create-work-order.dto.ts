import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';
import { CreateWorkOrderItemDto } from './create-work-order-item.dto';

export class CreateWorkOrderDto {
  @IsUUID() customerId!: string;
  @IsUUID() vehicleId!: string;
  @IsOptional() @IsString() @Length(1, 4000) reportedProblem?: string;
  @IsOptional() @IsString() @Length(1, 4000) diagnosis?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) mileage?: number;
  @IsOptional() @IsDateString() expectedCompletionDate?: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateWorkOrderItemDto) items?: CreateWorkOrderItemDto[];
}

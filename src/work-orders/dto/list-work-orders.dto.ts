import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListWorkOrdersDto {
  @IsOptional() @IsIn(['OPEN', 'WAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'DELIVERED', 'CANCELLED']) status?: string;
  @IsOptional() @IsIn(['UNPAID', 'PARTIAL', 'PAID']) financialStatus?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
}

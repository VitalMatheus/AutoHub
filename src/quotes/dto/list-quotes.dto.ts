import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListQuotesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']) status?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
}

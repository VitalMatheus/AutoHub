import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListQuotesDto {
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']) status?: string;
  @IsOptional() @IsUUID() customerId?: string;
}

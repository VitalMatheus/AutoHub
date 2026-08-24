import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const CUSTOMER_SORT_FIELDS = ['createdAt', 'name', 'updatedAt'] as const;
export type CustomerSortField = typeof CUSTOMER_SORT_FIELDS[number];

export class ListCustomersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean()
  active?: boolean;

  @IsOptional() @IsIn(CUSTOMER_SORT_FIELDS)
  sort: CustomerSortField = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'asc';
}

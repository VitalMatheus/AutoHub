import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const PRODUCT_SORT_FIELDS = ['createdAt', 'name', 'sku', 'salePrice', 'updatedAt'] as const;
export type ProductSortField = typeof PRODUCT_SORT_FIELDS[number];

export class ListProductsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean()
  active?: boolean;

  @IsOptional() @IsIn(PRODUCT_SORT_FIELDS)
  sort: ProductSortField = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'asc';
}

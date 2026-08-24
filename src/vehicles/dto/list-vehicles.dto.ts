import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export const VEHICLE_SORT_FIELDS = ['createdAt', 'plate', 'brand', 'model', 'year', 'mileage', 'updatedAt'] as const;
export type VehicleSortField = typeof VEHICLE_SORT_FIELDS[number];

export class ListVehiclesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsOptional() @IsUUID()
  customerId?: string;

  @IsOptional() @IsString()
  plate?: string;

  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean()
  active?: boolean;

  @IsOptional() @IsIn(VEHICLE_SORT_FIELDS)
  sort: VehicleSortField = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'asc';
}

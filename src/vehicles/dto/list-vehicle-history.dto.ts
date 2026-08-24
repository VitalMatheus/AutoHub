import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const VEHICLE_HISTORY_STATUSES = ['COMPLETED', 'DELIVERED'] as const;
export type VehicleHistoryStatus = typeof VEHICLE_HISTORY_STATUSES[number];

export class ListVehicleHistoryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsOptional() @IsIn(VEHICLE_HISTORY_STATUSES)
  status?: VehicleHistoryStatus;
}

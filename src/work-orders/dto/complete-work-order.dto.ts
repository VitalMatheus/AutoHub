import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class WorkOrderStockAllocationDto {
  @IsUUID() workOrderItemId!: string;
  @IsOptional() @IsUUID() stockEntryId?: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
}

export class CompleteWorkOrderDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkOrderStockAllocationDto)
  allocations?: WorkOrderStockAllocationDto[];
}

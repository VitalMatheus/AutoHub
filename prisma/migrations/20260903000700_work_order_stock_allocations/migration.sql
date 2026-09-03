CREATE UNIQUE INDEX "WorkOrderItem_organizationId_id_key" ON "WorkOrderItem"("organizationId", "id");

CREATE TABLE "WorkOrderStockAllocation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "workOrderItemId" UUID NOT NULL,
    "stockEntryId" UUID,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkOrderStockAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkOrderStockAllocation_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "WorkOrderStockAllocation_organizationId_id_key" ON "WorkOrderStockAllocation"("organizationId", "id");
CREATE INDEX "WorkOrderStockAllocation_organizationId_workOrderId_idx" ON "WorkOrderStockAllocation"("organizationId", "workOrderId");
CREATE INDEX "WorkOrderStockAllocation_organizationId_workOrderItemId_idx" ON "WorkOrderStockAllocation"("organizationId", "workOrderItemId");
CREATE INDEX "WorkOrderStockAllocation_organizationId_stockEntryId_idx" ON "WorkOrderStockAllocation"("organizationId", "stockEntryId");
ALTER TABLE "WorkOrderStockAllocation" ADD CONSTRAINT "WorkOrderStockAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderStockAllocation" ADD CONSTRAINT "WorkOrderStockAllocation_organizationId_workOrderId_fkey" FOREIGN KEY ("organizationId", "workOrderId") REFERENCES "WorkOrder"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderStockAllocation" ADD CONSTRAINT "WorkOrderStockAllocation_organizationId_workOrderItemId_fkey" FOREIGN KEY ("organizationId", "workOrderItemId") REFERENCES "WorkOrderItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderStockAllocation" ADD CONSTRAINT "WorkOrderStockAllocation_organizationId_stockEntryId_fkey" FOREIGN KEY ("organizationId", "stockEntryId") REFERENCES "StockEntry"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ticket #13: direct Work Orders.
ALTER TABLE "Organization" ADD COLUMN "nextWorkOrderNumber" INTEGER NOT NULL DEFAULT 1;

CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'WAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'DELIVERED', 'CANCELLED');

CREATE TABLE "WorkOrder" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organizationId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
  "reportedProblem" TEXT,
  "diagnosis" TEXT,
  "mileage" INTEGER,
  "expectedCompletionDate" DATE,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkOrderItem" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organizationId" UUID NOT NULL,
  "workOrderId" UUID NOT NULL,
  "type" "ItemType" NOT NULL,
  "serviceId" UUID,
  "productId" UUID,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WorkOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkOrder_organizationId_id_key" ON "WorkOrder"("organizationId", "id");
CREATE UNIQUE INDEX "WorkOrder_organizationId_number_key" ON "WorkOrder"("organizationId", "number");
CREATE INDEX "WorkOrder_organizationId_status_createdAt_idx" ON "WorkOrder"("organizationId", "status", "createdAt");
CREATE INDEX "WorkOrder_organizationId_customerId_idx" ON "WorkOrder"("organizationId", "customerId");
CREATE INDEX "WorkOrder_organizationId_vehicleId_idx" ON "WorkOrder"("organizationId", "vehicleId");
CREATE INDEX "WorkOrderItem_organizationId_workOrderId_idx" ON "WorkOrderItem"("organizationId", "workOrderId");

ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customer_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vehicle_fkey" FOREIGN KEY ("organizationId", "vehicleId") REFERENCES "Vehicle"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_workOrder_fkey" FOREIGN KEY ("organizationId", "workOrderId") REFERENCES "WorkOrder"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_service_fkey" FOREIGN KEY ("organizationId", "serviceId") REFERENCES "Service"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_product_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

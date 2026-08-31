CREATE TYPE "StockMovementType" AS ENUM ('CONSUMPTION', 'ADJUSTMENT');

CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organizationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "workOrderId" UUID,
    "type" "StockMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockMovement_organizationId_productId_workOrderId_type_key"
  ON "StockMovement"("organizationId", "productId", "workOrderId", "type");
CREATE INDEX "StockMovement_organizationId_productId_createdAt_idx"
  ON "StockMovement"("organizationId", "productId", "createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_productId_fkey"
  FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_workOrderId_fkey"
  FOREIGN KEY ("organizationId", "workOrderId") REFERENCES "WorkOrder"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantityChange_nonzero_check" CHECK ("quantityChange" <> 0);

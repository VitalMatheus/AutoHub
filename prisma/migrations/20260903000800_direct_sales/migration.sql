ALTER TABLE "Organization" ADD COLUMN "nextDirectSaleNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StockMovement" ADD COLUMN "directSaleId" UUID;

CREATE TYPE "DirectSaleStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

CREATE TABLE "DirectSale" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "customerId" UUID,
  "number" INTEGER NOT NULL,
  "status" "DirectSaleStatus" NOT NULL DEFAULT 'DRAFT',
  "confirmedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "DirectSale_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DirectSaleItem" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "directSaleId" UUID NOT NULL,
  "productId" UUID NOT NULL, "productName" TEXT NOT NULL, "sku" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL, "unitPrice" DECIMAL(12,2) NOT NULL,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectSaleItem_pkey" PRIMARY KEY ("id"), CONSTRAINT "DirectSaleItem_quantity_check" CHECK ("quantity" > 0), CONSTRAINT "DirectSaleItem_discount_check" CHECK ("discount" >= 0)
);
CREATE TABLE "DirectSaleStockAllocation" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "directSaleId" UUID NOT NULL,
  "directSaleItemId" UUID NOT NULL, "stockEntryId" UUID, "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectSaleStockAllocation_pkey" PRIMARY KEY ("id"), CONSTRAINT "DirectSaleStockAllocation_quantity_check" CHECK ("quantity" > 0)
);
CREATE TABLE "SalePayment" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "directSaleId" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL, "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED', "paidAt" TIMESTAMPTZ(3),
  "installmentDueDate" DATE, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id"), CONSTRAINT "SalePayment_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "DirectSale_organizationId_id_key" ON "DirectSale"("organizationId", "id");
CREATE UNIQUE INDEX "DirectSale_organizationId_number_key" ON "DirectSale"("organizationId", "number");
CREATE UNIQUE INDEX "DirectSaleItem_organizationId_id_key" ON "DirectSaleItem"("organizationId", "id");
CREATE INDEX "DirectSale_org_status_created_idx" ON "DirectSale"("organizationId", "status", "createdAt");
CREATE INDEX "DirectSaleItem_org_sale_idx" ON "DirectSaleItem"("organizationId", "directSaleId");
CREATE INDEX "DirectSaleAllocation_org_sale_idx" ON "DirectSaleStockAllocation"("organizationId", "directSaleId");
CREATE INDEX "DirectSaleAllocation_org_entry_idx" ON "DirectSaleStockAllocation"("organizationId", "stockEntryId");
CREATE INDEX "SalePayment_org_sale_status_idx" ON "SalePayment"("organizationId", "directSaleId", "status");
ALTER TABLE "DirectSale" ADD CONSTRAINT "DirectSale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectSale" ADD CONSTRAINT "DirectSale_customer_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectSaleItem" ADD CONSTRAINT "DirectSaleItem_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectSaleItem" ADD CONSTRAINT "DirectSaleItem_sale_fkey" FOREIGN KEY ("organizationId", "directSaleId") REFERENCES "DirectSale"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectSaleItem" ADD CONSTRAINT "DirectSaleItem_product_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectSaleStockAllocation" ADD CONSTRAINT "DirectSaleAllocation_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectSaleStockAllocation" ADD CONSTRAINT "DirectSaleAllocation_sale_fkey" FOREIGN KEY ("organizationId", "directSaleId") REFERENCES "DirectSale"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectSaleStockAllocation" ADD CONSTRAINT "DirectSaleAllocation_item_fkey" FOREIGN KEY ("organizationId", "directSaleItemId") REFERENCES "DirectSaleItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectSaleStockAllocation" ADD CONSTRAINT "DirectSaleAllocation_entry_fkey" FOREIGN KEY ("organizationId", "stockEntryId") REFERENCES "StockEntry"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_sale_fkey" FOREIGN KEY ("organizationId", "directSaleId") REFERENCES "DirectSale"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_direct_sale_fkey" FOREIGN KEY ("organizationId", "directSaleId") REFERENCES "DirectSale"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

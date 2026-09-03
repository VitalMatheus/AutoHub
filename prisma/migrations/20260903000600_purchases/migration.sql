CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "StockEntryStatus" AS ENUM ('AVAILABLE', 'CANCELLED');

CREATE TABLE "Purchase" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(), "organizationId" UUID NOT NULL, "supplierId" UUID NOT NULL,
  "expenseId" UUID, "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT', "purchaseDate" DATE NOT NULL,
  "dueDate" DATE NOT NULL, "documentNumber" TEXT, "notes" TEXT, "confirmedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseItem" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(), "organizationId" UUID NOT NULL, "purchaseId" UUID NOT NULL,
  "productId" UUID NOT NULL, "productName" TEXT NOT NULL, "sku" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL, "warrantyDays" INTEGER NOT NULL DEFAULT 0, "batchNumber" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StockEntry" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(), "organizationId" UUID NOT NULL, "purchaseId" UUID NOT NULL,
  "purchaseItemId" UUID NOT NULL, "productId" UUID NOT NULL, "supplierId" UUID NOT NULL, "quantity" INTEGER NOT NULL,
  "consumedQuantity" INTEGER NOT NULL DEFAULT 0, "unitCost" DECIMAL(12,2) NOT NULL, "purchaseDate" DATE NOT NULL,
  "batchNumber" TEXT, "documentNumber" TEXT, "warrantyDays" INTEGER NOT NULL DEFAULT 0,
  "status" "StockEntryStatus" NOT NULL DEFAULT 'AVAILABLE', "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Purchase_expenseId_key" ON "Purchase"("expenseId");
CREATE UNIQUE INDEX "Purchase_organizationId_id_key" ON "Purchase"("organizationId", "id");
CREATE UNIQUE INDEX "Purchase_organizationId_expenseId_key" ON "Purchase"("organizationId", "expenseId");
CREATE INDEX "Purchase_organizationId_status_purchaseDate_idx" ON "Purchase"("organizationId", "status", "purchaseDate");
CREATE INDEX "Purchase_organizationId_supplierId_idx" ON "Purchase"("organizationId", "supplierId");
CREATE UNIQUE INDEX "PurchaseItem_organizationId_id_key" ON "PurchaseItem"("organizationId", "id");
CREATE INDEX "PurchaseItem_organizationId_purchaseId_idx" ON "PurchaseItem"("organizationId", "purchaseId");
CREATE UNIQUE INDEX "StockEntry_purchaseItemId_key" ON "StockEntry"("purchaseItemId");
CREATE UNIQUE INDEX "StockEntry_organizationId_id_key" ON "StockEntry"("organizationId", "id");
CREATE UNIQUE INDEX "StockEntry_organizationId_purchaseItemId_key" ON "StockEntry"("organizationId", "purchaseItemId");
CREATE INDEX "StockEntry_organizationId_productId_status_createdAt_idx" ON "StockEntry"("organizationId", "productId", "status", "createdAt");
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_organizationId_supplierId_fkey" FOREIGN KEY ("organizationId", "supplierId") REFERENCES "Supplier"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_organizationId_expenseId_fkey" FOREIGN KEY ("organizationId", "expenseId") REFERENCES "Expense"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_organizationId_purchaseId_fkey" FOREIGN KEY ("organizationId", "purchaseId") REFERENCES "Purchase"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_organizationId_purchaseId_fkey" FOREIGN KEY ("organizationId", "purchaseId") REFERENCES "Purchase"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_organizationId_purchaseItemId_fkey" FOREIGN KEY ("organizationId", "purchaseItemId") REFERENCES "PurchaseItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_organizationId_supplierId_fkey" FOREIGN KEY ("organizationId", "supplierId") REFERENCES "Supplier"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_dates_check" CHECK ("dueDate" >= "purchaseDate");
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_values_check" CHECK ("quantity" > 0 AND "unitCost" > 0 AND "warrantyDays" >= 0);
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_values_check" CHECK ("quantity" > 0 AND "consumedQuantity" >= 0 AND "consumedQuantity" <= "quantity" AND "unitCost" > 0);

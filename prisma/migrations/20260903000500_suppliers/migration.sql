CREATE TABLE "Supplier" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProductSupplier" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organizationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "externalCode" TEXT,
    "lastCost" DECIMAL(12,2),
    "warrantyDays" INTEGER NOT NULL DEFAULT 0,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ProductSupplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Supplier_organizationId_id_key" ON "Supplier"("organizationId", "id");
CREATE UNIQUE INDEX "Supplier_organizationId_document_key" ON "Supplier"("organizationId", "document");
CREATE INDEX "Supplier_organizationId_active_name_id_idx" ON "Supplier"("organizationId", "active", "name", "id");
CREATE UNIQUE INDEX "ProductSupplier_organizationId_id_key" ON "ProductSupplier"("organizationId", "id");
CREATE UNIQUE INDEX "ProductSupplier_organizationId_productId_supplierId_key" ON "ProductSupplier"("organizationId", "productId", "supplierId");
CREATE INDEX "ProductSupplier_organizationId_supplierId_idx" ON "ProductSupplier"("organizationId", "supplierId");
CREATE INDEX "ProductSupplier_organizationId_productId_preferred_idx" ON "ProductSupplier"("organizationId", "productId", "preferred");
CREATE UNIQUE INDEX "ProductSupplier_one_preferred_per_product" ON "ProductSupplier"("organizationId", "productId") WHERE "preferred" = true;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_organizationId_supplierId_fkey" FOREIGN KEY ("organizationId", "supplierId") REFERENCES "Supplier"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

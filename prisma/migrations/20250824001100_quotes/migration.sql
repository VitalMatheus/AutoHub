CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ItemType" AS ENUM ('SERVICE', 'PRODUCT', 'MANUAL');

ALTER TABLE "Organization" ADD COLUMN "nextQuoteNumber" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "Quote" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organizationId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Quote_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Quote_organizationId_vehicleId_fkey" FOREIGN KEY ("organizationId", "vehicleId") REFERENCES "Vehicle"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Quote_organizationId_id_key" ON "Quote"("organizationId", "id");
CREATE UNIQUE INDEX "Quote_organizationId_number_key" ON "Quote"("organizationId", "number");
CREATE INDEX "Quote_organizationId_status_createdAt_idx" ON "Quote"("organizationId", "status", "createdAt");
CREATE INDEX "Quote_organizationId_customerId_idx" ON "Quote"("organizationId", "customerId");
CREATE INDEX "Quote_organizationId_vehicleId_idx" ON "Quote"("organizationId", "vehicleId");

CREATE TABLE "QuoteItem" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organizationId" UUID NOT NULL,
  "quoteId" UUID NOT NULL,
  "type" "ItemType" NOT NULL,
  "serviceId" UUID,
  "productId" UUID,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuoteItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuoteItem_organizationId_quoteId_fkey" FOREIGN KEY ("organizationId", "quoteId") REFERENCES "Quote"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuoteItem_organizationId_serviceId_fkey" FOREIGN KEY ("organizationId", "serviceId") REFERENCES "Service"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuoteItem_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuoteItem_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "QuoteItem_unitPrice_nonnegative" CHECK ("unitPrice" >= 0),
  CONSTRAINT "QuoteItem_type_reference_check" CHECK (
    ("type" = 'SERVICE' AND "serviceId" IS NOT NULL AND "productId" IS NULL) OR
    ("type" = 'PRODUCT' AND "productId" IS NOT NULL AND "serviceId" IS NULL) OR
    ("type" = 'MANUAL' AND "serviceId" IS NULL AND "productId" IS NULL)
  )
);
CREATE INDEX "QuoteItem_organizationId_quoteId_idx" ON "QuoteItem"("organizationId", "quoteId");

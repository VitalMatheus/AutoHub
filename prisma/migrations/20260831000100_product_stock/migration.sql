ALTER TABLE "Product" ADD COLUMN "stockQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "stockMinimum" INTEGER NOT NULL DEFAULT 0;

UPDATE "Product"
SET "sku" = 'PROD-' || UPPER(REPLACE("id"::text, '-', ''))
WHERE "sku" IS NULL;

ALTER TABLE "Product" ADD CONSTRAINT "Product_stockQuantity_nonnegative_check" CHECK ("stockQuantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockMinimum_nonnegative_check" CHECK ("stockMinimum" >= 0);
CREATE INDEX "Product_organizationId_lowStock_idx" ON "Product"("organizationId", "stockQuantity", "stockMinimum");

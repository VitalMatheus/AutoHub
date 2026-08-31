-- Products created before automatic SKU generation may still have a null SKU.
UPDATE "Product"
SET "sku" = 'PROD-' || UPPER(REPLACE("id"::text, '-', ''))
WHERE "sku" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "sku" SET NOT NULL;

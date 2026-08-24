-- Database-level invariants for tenant identities, catalog prices and document snapshots.
ALTER TABLE "User"
  ADD CONSTRAINT "User_role_organization_check" CHECK (
    ("role" = 'SUPER_ADMIN' AND "organizationId" IS NULL) OR
    ("role" = 'ADMIN' AND "organizationId" IS NOT NULL)
  );

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_price_nonnegative_check" CHECK ("price" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_salePrice_nonnegative_check" CHECK ("salePrice" >= 0);

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "QuoteItem_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "QuoteItem_unitPrice_nonnegative_check" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "QuoteItem_type_catalog_link_check" CHECK (
    ("type" = 'SERVICE' AND "serviceId" IS NOT NULL AND "productId" IS NULL) OR
    ("type" = 'PRODUCT' AND "productId" IS NOT NULL AND "serviceId" IS NULL) OR
    ("type" = 'MANUAL' AND "serviceId" IS NULL AND "productId" IS NULL)
  );

ALTER TABLE "WorkOrderItem"
  ADD CONSTRAINT "WorkOrderItem_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "WorkOrderItem_unitPrice_nonnegative_check" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "WorkOrderItem_type_catalog_link_check" CHECK (
    ("type" = 'SERVICE' AND "serviceId" IS NOT NULL AND "productId" IS NULL) OR
    ("type" = 'PRODUCT' AND "productId" IS NOT NULL AND "serviceId" IS NULL) OR
    ("type" = 'MANUAL' AND "serviceId" IS NULL AND "productId" IS NULL)
  );

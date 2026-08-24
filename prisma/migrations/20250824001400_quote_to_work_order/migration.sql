-- Ticket #14: an approved Quote can generate at most one Work Order.
ALTER TABLE "WorkOrder" ADD COLUMN "quoteId" UUID;

CREATE UNIQUE INDEX "WorkOrder_organizationId_quoteId_key" ON "WorkOrder"("organizationId", "quoteId");

ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_quote_fkey"
  FOREIGN KEY ("organizationId", "quoteId") REFERENCES "Quote"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

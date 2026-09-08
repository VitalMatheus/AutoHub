ALTER TABLE "Payment" ADD COLUMN "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_discount_non_negative" CHECK ("discount" >= 0);

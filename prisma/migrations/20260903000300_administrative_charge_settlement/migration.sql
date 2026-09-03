-- Preserve the origin of a receipt independently from provider/external IDs.
CREATE TYPE "ChargeSettlementOrigin" AS ENUM ('GATEWAY', 'ADMINISTRATIVE');
CREATE TYPE "AdministrativeSettlementMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'CHECK', 'OTHER');

ALTER TABLE "ChargeSettlement"
  ADD COLUMN "origin" "ChargeSettlementOrigin" NOT NULL DEFAULT 'GATEWAY',
  ADD COLUMN "method" "AdministrativeSettlementMethod";

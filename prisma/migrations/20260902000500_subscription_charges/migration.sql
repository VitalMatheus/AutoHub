CREATE TYPE "SubscriptionChargeNature" AS ENUM ('FIRST_PAYMENT', 'RENEWAL', 'ADJUSTMENT', 'EXTRAORDINARY');
CREATE TYPE "ChargeSettlementKind" AS ENUM ('RECEIPT', 'REVERSAL');

CREATE TABLE "SubscriptionCharge" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(), "commercialAccountId" UUID NOT NULL, "subscriptionId" UUID NOT NULL,
  "organizationId" UUID, "amount" DECIMAL(12,2) NOT NULL, "dueDate" DATE NOT NULL, "nature" "SubscriptionChargeNature" NOT NULL,
  "billingPeriodStart" DATE, "billingPeriodEnd" DATE, "provider" TEXT, "externalId" TEXT, "cancelledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionCharge_commercialAccountId_fkey" FOREIGN KEY ("commercialAccountId") REFERENCES "CommercialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SubscriptionCharge_provider_externalId_key" ON "SubscriptionCharge"("provider", "externalId");
CREATE UNIQUE INDEX "SubscriptionCharge_subscriptionId_nature_billingPeriodStart_billingPeriodEnd_key" ON "SubscriptionCharge"("subscriptionId", "nature", "billingPeriodStart", "billingPeriodEnd");
CREATE INDEX "SubscriptionCharge_commercialAccountId_dueDate_idx" ON "SubscriptionCharge"("commercialAccountId", "dueDate");
CREATE INDEX "SubscriptionCharge_subscriptionId_dueDate_idx" ON "SubscriptionCharge"("subscriptionId", "dueDate");
CREATE INDEX "SubscriptionCharge_organizationId_dueDate_idx" ON "SubscriptionCharge"("organizationId", "dueDate");

CREATE TABLE "ChargeSettlement" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(), "chargeId" UUID NOT NULL, "originalSettlementId" UUID, "kind" "ChargeSettlementKind" NOT NULL DEFAULT 'RECEIPT',
  "amount" DECIMAL(12,2) NOT NULL, "receivedAt" TIMESTAMPTZ(3) NOT NULL, "effectiveAt" TIMESTAMPTZ(3), "reason" TEXT, "provider" TEXT, "externalId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChargeSettlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChargeSettlement_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "SubscriptionCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChargeSettlement_originalSettlementId_fkey" FOREIGN KEY ("originalSettlementId") REFERENCES "ChargeSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChargeSettlement_provider_externalId_key" ON "ChargeSettlement"("provider", "externalId");
CREATE INDEX "ChargeSettlement_chargeId_createdAt_idx" ON "ChargeSettlement"("chargeId", "createdAt");
CREATE INDEX "ChargeSettlement_originalSettlementId_idx" ON "ChargeSettlement"("originalSettlementId");

CREATE TYPE "CardAttemptStatus" AS ENUM ('PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'REVERSED');
CREATE TYPE "CardAttemptKind" AS ENUM ('INITIAL', 'RENEWAL');

ALTER TABLE "Subscription"
  ADD COLUMN "cardRenewalAuthorized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cardRenewalAuthorizedAt" TIMESTAMPTZ(3),
  ADD COLUMN "cardRenewalRevokedAt" TIMESTAMPTZ(3),
  ADD COLUMN "providerCustomerRef" TEXT,
  ADD COLUMN "providerPaymentMethodRef" TEXT;

-- The composite foreign key below needs this exact referenced key to exist
-- before PostgreSQL creates CardPaymentAttempt.
ALTER TABLE "SubscriptionCharge"
  ADD CONSTRAINT "SubscriptionCharge_commercialAccountId_id_key" UNIQUE ("commercialAccountId", "id");

CREATE TABLE "CardPaymentAttempt" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organizationId" UUID NOT NULL,
  "commercialAccountId" UUID NOT NULL,
  "subscriptionId" UUID NOT NULL,
  "chargeId" UUID NOT NULL,
  "planVersionId" UUID NOT NULL,
  "kind" "CardAttemptKind" NOT NULL DEFAULT 'INITIAL',
  "idempotencyKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'ASAAS',
  "externalId" TEXT,
  "status" "CardAttemptStatus" NOT NULL DEFAULT 'PROCESSING',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "planNameSnapshot" TEXT NOT NULL,
  "planPriceSnapshot" DECIMAL(12,2) NOT NULL,
  "planIntervalSnapshot" "BillingInterval" NOT NULL,
  "billingDay" INTEGER NOT NULL,
  "authorizeRenewal" BOOLEAN NOT NULL DEFAULT false,
  "providerCustomerRef" TEXT,
  "providerPaymentMethodRef" TEXT,
  "checkoutUrl" TEXT,
  "expiresAt" TIMESTAMPTZ(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardPaymentAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardPaymentAttempt_commercialAccountId_organizationId_fkey" FOREIGN KEY ("commercialAccountId", "organizationId") REFERENCES "Organization"("commercialAccountId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CardPaymentAttempt_commercialAccountId_fkey" FOREIGN KEY ("commercialAccountId") REFERENCES "CommercialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CardPaymentAttempt_commercialAccountId_subscriptionId_fkey" FOREIGN KEY ("commercialAccountId", "subscriptionId") REFERENCES "Subscription"("commercialAccountId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CardPaymentAttempt_commercialAccountId_chargeId_fkey" FOREIGN KEY ("commercialAccountId", "chargeId") REFERENCES "SubscriptionCharge"("commercialAccountId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CardPaymentAttempt_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CardPaymentAttempt_idempotencyKey_key" ON "CardPaymentAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "CardPaymentAttempt_externalId_key" ON "CardPaymentAttempt"("externalId");
CREATE INDEX "CardPaymentAttempt_organizationId_status_createdAt_idx" ON "CardPaymentAttempt"("organizationId", "status", "createdAt");
CREATE INDEX "CardPaymentAttempt_chargeId_status_idx" ON "CardPaymentAttempt"("chargeId", "status");
CREATE INDEX "CardPaymentAttempt_subscriptionId_kind_status_idx" ON "CardPaymentAttempt"("subscriptionId", "kind", "status");

ALTER TABLE "AsaasWebhookEvent" ADD COLUMN "cardAttemptId" UUID;
ALTER TABLE "AsaasWebhookEvent" ADD CONSTRAINT "AsaasWebhookEvent_cardAttemptId_fkey" FOREIGN KEY ("cardAttemptId") REFERENCES "CardPaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AsaasWebhookEvent_cardAttemptId_receivedAt_idx" ON "AsaasWebhookEvent"("cardAttemptId", "receivedAt");

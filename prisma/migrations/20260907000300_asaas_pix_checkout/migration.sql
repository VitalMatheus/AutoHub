CREATE TYPE "PixAttemptStatus" AS ENUM ('PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'REVERSED');

CREATE TABLE "PixPaymentAttempt" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organizationId" UUID NOT NULL,
  "commercialAccountId" UUID NOT NULL,
  "chargeId" UUID NOT NULL,
  "planVersionId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'ASAAS',
  "externalId" TEXT,
  "status" "PixAttemptStatus" NOT NULL DEFAULT 'PROCESSING',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "planNameSnapshot" TEXT NOT NULL,
  "planPriceSnapshot" DECIMAL(12,2) NOT NULL,
  "planIntervalSnapshot" "BillingInterval" NOT NULL,
  "billingDay" INTEGER NOT NULL,
  "qrCode" TEXT,
  "copyPasteCode" TEXT,
  "expiresAt" TIMESTAMPTZ(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PixPaymentAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PixPaymentAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PixPaymentAttempt_commercialAccountId_fkey" FOREIGN KEY ("commercialAccountId") REFERENCES "CommercialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PixPaymentAttempt_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "SubscriptionCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PixPaymentAttempt_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PixPaymentAttempt_idempotencyKey_key" ON "PixPaymentAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "PixPaymentAttempt_externalId_key" ON "PixPaymentAttempt"("externalId");
CREATE INDEX "PixPaymentAttempt_organizationId_status_createdAt_idx" ON "PixPaymentAttempt"("organizationId", "status", "createdAt");
CREATE INDEX "PixPaymentAttempt_chargeId_status_idx" ON "PixPaymentAttempt"("chargeId", "status");

CREATE TABLE "AsaasWebhookEvent" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "eventId" TEXT NOT NULL,
  "paymentAttemptId" UUID,
  "eventType" TEXT NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ(3),
  "payload" JSONB NOT NULL,
  CONSTRAINT "AsaasWebhookEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AsaasWebhookEvent_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PixPaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AsaasWebhookEvent_eventId_key" ON "AsaasWebhookEvent"("eventId");
CREATE INDEX "AsaasWebhookEvent_paymentAttemptId_receivedAt_idx" ON "AsaasWebhookEvent"("paymentAttemptId", "receivedAt");

CREATE TYPE "SubscriptionChargeReminderKind" AS ENUM ('PRE_DUE', 'DUE_DATE', 'TOLERANCE_END');

CREATE TABLE "SubscriptionChargeReminder" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "commercialAccountId" UUID NOT NULL,
  "chargeId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "recipientUserId" UUID NOT NULL,
  "kind" "SubscriptionChargeReminderKind" NOT NULL,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
  "claimedAt" TIMESTAMPTZ(3),
  "sentAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionChargeReminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionChargeReminder_commercialAccountId_fkey" FOREIGN KEY ("commercialAccountId") REFERENCES "CommercialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionChargeReminder_commercialAccountId_chargeId_fkey"
    FOREIGN KEY ("commercialAccountId", "chargeId") REFERENCES "SubscriptionCharge"("commercialAccountId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionChargeReminder_commercialAccountId_organizationId_fkey"
    FOREIGN KEY ("commercialAccountId", "organizationId") REFERENCES "Organization"("commercialAccountId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionChargeReminder_organizationId_recipientUserId_fkey"
    FOREIGN KEY ("organizationId", "recipientUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SubscriptionChargeReminder_chargeId_recipientUserId_kind_key"
  ON "SubscriptionChargeReminder" ("chargeId", "recipientUserId", "kind");
CREATE INDEX "SubscriptionChargeReminder_scheduledAt_sentAt_claimedAt_idx"
  ON "SubscriptionChargeReminder" ("scheduledAt", "sentAt", "claimedAt");
CREATE INDEX "SubscriptionChargeReminder_organizationId_scheduledAt_idx"
  ON "SubscriptionChargeReminder" ("organizationId", "scheduledAt");

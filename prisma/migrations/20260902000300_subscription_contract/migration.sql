ALTER TABLE "Subscription"
  ADD COLUMN "contractedPrice" DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN "contractedCurrency" CHAR(3) DEFAULT 'BRL',
  ADD COLUMN "contractedInterval" "BillingInterval" DEFAULT 'MONTHLY',
  ADD COLUMN "contractedOrganizationLimit" INTEGER DEFAULT 1,
  ADD COLUMN "contractedUserLimit" INTEGER DEFAULT 1,
  ADD COLUMN "contractedWorkOrderLimit" INTEGER,
  ADD COLUMN "contractedGracePeriodDays" INTEGER DEFAULT 5,
  ADD COLUMN "migratedAt" TIMESTAMPTZ(3),
  ADD COLUMN "regularizedAt" TIMESTAMPTZ(3),
  ADD COLUMN "regularizationReason" TEXT,
  ADD COLUMN "commercialStartAt" TIMESTAMPTZ(3),
  ADD COLUMN "trialStartsAt" TIMESTAMPTZ(3),
  ADD COLUMN "trialEndsAt" TIMESTAMPTZ(3),
  ADD COLUMN "firstPaidPeriodStartedAt" TIMESTAMPTZ(3),
  ADD COLUMN "firstPaymentReceivedAt" TIMESTAMPTZ(3),
  ADD COLUMN "currentPeriodStart" TIMESTAMPTZ(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMPTZ(3),
  ADD COLUMN "cancellationRequestedAt" TIMESTAMPTZ(3),
  ADD COLUMN "effectiveCancellationAt" TIMESTAMPTZ(3);

UPDATE "Subscription" s
SET "contractedPrice" = pv."price",
    "contractedCurrency" = pv."currency",
    "contractedInterval" = pv."interval",
    "contractedOrganizationLimit" = pv."organizationLimit",
    "contractedUserLimit" = pv."userLimit",
    "contractedWorkOrderLimit" = pv."workOrderLimit",
    "contractedGracePeriodDays" = pv."gracePeriodDays",
    "migratedAt" = s."createdAt"
FROM "PlanVersion" pv
WHERE pv."id" = s."planVersionId";

ALTER TABLE "Subscription"
  ALTER COLUMN "contractedPrice" SET NOT NULL,
  ALTER COLUMN "contractedCurrency" SET NOT NULL,
  ALTER COLUMN "contractedInterval" SET NOT NULL,
  ALTER COLUMN "contractedOrganizationLimit" SET NOT NULL,
  ALTER COLUMN "contractedUserLimit" SET NOT NULL,
  ALTER COLUMN "contractedGracePeriodDays" SET NOT NULL;

CREATE UNIQUE INDEX "Subscription_one_open_per_account_idx"
  ON "Subscription" ("commercialAccountId")
  WHERE "commercialAccountId" IS NOT NULL AND "status" <> 'ENDED';

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_contract_snapshot_check"
  CHECK ("contractedPrice" >= 0 AND "contractedOrganizationLimit" > 0 AND "contractedUserLimit" > 0 AND "contractedGracePeriodDays" >= 0);

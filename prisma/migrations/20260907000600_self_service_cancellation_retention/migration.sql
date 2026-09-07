ALTER TYPE "ActionTokenPurpose" ADD VALUE 'CONFIRM_SUBSCRIPTION_CANCELLATION';

ALTER TABLE "Subscription"
  ADD COLUMN "dataRetentionEndsAt" TIMESTAMPTZ(3),
  ADD COLUMN "dataFinalizedAt" TIMESTAMPTZ(3);

ALTER TABLE "ActionToken"
  ADD COLUMN "targetSubscriptionId" UUID;

CREATE INDEX "ActionToken_targetSubscriptionId_purpose_usedAt_idx"
  ON "ActionToken" ("targetSubscriptionId", "purpose", "usedAt");

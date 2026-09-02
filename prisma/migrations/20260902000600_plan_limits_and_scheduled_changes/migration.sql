ALTER TABLE "Subscription"
  ADD COLUMN "scheduledPlanVersionId" UUID,
  ADD COLUMN "scheduledPlanEffectiveAt" TIMESTAMPTZ(3),
  ADD COLUMN "scheduledPlanReason" TEXT,
  ADD COLUMN "scheduledRecurringAdjustment" DECIMAL(12,2),
  ADD COLUMN "scheduledAdjustmentEffectiveAt" TIMESTAMPTZ(3),
  ADD COLUMN "scheduledAdjustmentReason" TEXT;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_scheduledPlanVersionId_fkey"
  FOREIGN KEY ("scheduledPlanVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Subscription_scheduled_change_check"
  CHECK (("scheduledPlanVersionId" IS NULL AND "scheduledPlanEffectiveAt" IS NULL AND "scheduledPlanReason" IS NULL)
      OR ("scheduledPlanVersionId" IS NOT NULL AND "scheduledPlanEffectiveAt" IS NOT NULL AND "scheduledPlanReason" IS NOT NULL)),
  ADD CONSTRAINT "Subscription_scheduled_adjustment_check"
  CHECK (("scheduledRecurringAdjustment" IS NULL AND "scheduledAdjustmentEffectiveAt" IS NULL AND "scheduledAdjustmentReason" IS NULL)
      OR ("scheduledRecurringAdjustment" IS NOT NULL AND "scheduledAdjustmentEffectiveAt" IS NOT NULL AND "scheduledAdjustmentReason" IS NOT NULL));

CREATE INDEX "Subscription_scheduledPlanVersionId_scheduledPlanEffectiveAt_idx"
  ON "Subscription" ("scheduledPlanVersionId", "scheduledPlanEffectiveAt");

ALTER TABLE "PlanVersion"
  ADD CONSTRAINT "PlanVersion_commercial_conditions_check"
  CHECK ("price" >= 0 AND "organizationLimit" > 0 AND "userLimit" > 0 AND ("workOrderLimit" IS NULL OR "workOrderLimit" > 0) AND "gracePeriodDays" >= 0);

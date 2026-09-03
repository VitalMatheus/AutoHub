ALTER TABLE "Subscription"
  ADD COLUMN "firstDueDate" DATE,
  ADD COLUMN "billingDay" INTEGER;

-- Only issued Charges are treated as trustworthy historical evidence. Records
-- without one remain nullable and are surfaced for explicit regularization.
UPDATE "Subscription" s
SET "firstDueDate" = evidence."firstDueDate",
    "billingDay" = EXTRACT(DAY FROM evidence."firstDueDate")::INTEGER
FROM (
  SELECT "subscriptionId", MIN("dueDate") AS "firstDueDate"
  FROM "SubscriptionCharge"
  WHERE "cancelledAt" IS NULL
  GROUP BY "subscriptionId"
) evidence
WHERE evidence."subscriptionId" = s."id"
  AND EXTRACT(DAY FROM evidence."firstDueDate") BETWEEN 1 AND 28
  AND s."firstDueDate" IS NULL
  AND s."billingDay" IS NULL;

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_billing_day_check"
  CHECK ("billingDay" IS NULL OR "billingDay" BETWEEN 1 AND 28);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_commercial_schedule_pair_check"
  CHECK (("firstDueDate" IS NULL) = ("billingDay" IS NULL));

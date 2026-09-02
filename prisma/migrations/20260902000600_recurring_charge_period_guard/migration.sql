-- The Prisma composite unique index cannot enforce uniqueness when nullable
-- period columns are NULL in PostgreSQL. Recurring charges always carry both
-- period boundaries, so make that invariant explicit at the database boundary.
CREATE UNIQUE INDEX "SubscriptionCharge_subscriptionId_renewal_period_key"
  ON "SubscriptionCharge" ("subscriptionId", "billingPeriodStart", "billingPeriodEnd")
  WHERE "nature" = 'RENEWAL' AND "billingPeriodStart" IS NOT NULL AND "billingPeriodEnd" IS NOT NULL;

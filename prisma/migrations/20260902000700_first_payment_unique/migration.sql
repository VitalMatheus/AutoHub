-- FIRST_PAYMENT has no billing period, so the nullable composite unique index
-- cannot enforce one first charge per subscription.
CREATE UNIQUE INDEX "SubscriptionCharge_subscriptionId_first_payment_key"
  ON "SubscriptionCharge" ("subscriptionId")
  WHERE "nature" = 'FIRST_PAYMENT';

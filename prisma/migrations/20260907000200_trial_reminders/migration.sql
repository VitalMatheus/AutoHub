CREATE TYPE "TrialReminderKind" AS ENUM ('SEVEN_DAYS_REMAINING', 'THREE_DAYS_REMAINING', 'ONE_DAY_REMAINING', 'EXPIRED');

CREATE TABLE "TrialReminder" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "commercialAccountId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "kind" "TrialReminderKind" NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "claimedAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialReminder_subscriptionId_kind_key" ON "TrialReminder"("subscriptionId", "kind");
CREATE INDEX "TrialReminder_scheduledAt_sentAt_claimedAt_idx" ON "TrialReminder"("scheduledAt", "sentAt", "claimedAt");
CREATE INDEX "TrialReminder_organizationId_scheduledAt_idx" ON "TrialReminder"("organizationId", "scheduledAt");

CREATE UNIQUE INDEX "Subscription_id_commercialAccountId_key" ON "Subscription"("id", "commercialAccountId");
ALTER TABLE "TrialReminder" ADD CONSTRAINT "TrialReminder_subscription_commercial_account_fkey" FOREIGN KEY ("subscriptionId", "commercialAccountId") REFERENCES "Subscription"("id", "commercialAccountId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrialReminder" ADD CONSTRAINT "TrialReminder_organization_commercial_account_fkey" FOREIGN KEY ("commercialAccountId", "organizationId") REFERENCES "Organization"("commercialAccountId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrialReminder" ADD CONSTRAINT "TrialReminder_recipient_same_organization_fkey" FOREIGN KEY ("organizationId", "recipientUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

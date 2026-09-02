CREATE TYPE "PlanVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY');
CREATE TYPE "SubscriptionStatus" AS ENUM ('SCHEDULED', 'CURRENT', 'ENDED');

CREATE TABLE "Plan" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(), "name" TEXT NOT NULL, "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

CREATE TABLE "PlanVersion" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(), "planId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "status" "PlanVersionStatus" NOT NULL DEFAULT 'DRAFT', "price" DECIMAL(12,2) NOT NULL, "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
  "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY', "organizationLimit" INTEGER NOT NULL, "userLimit" INTEGER NOT NULL,
  "workOrderLimit" INTEGER, "gracePeriodDays" INTEGER NOT NULL DEFAULT 5, "publishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id"), CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");
CREATE INDEX "PlanVersion_status_publishedAt_idx" ON "PlanVersion"("status", "publishedAt");

CREATE TABLE "Subscription" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(), "planVersionId" UUID NOT NULL, "status" "SubscriptionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"), CONSTRAINT "Subscription_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Subscription_planVersionId_status_idx" ON "Subscription"("planVersionId", "status");

INSERT INTO "Plan" ("id", "name") VALUES ('00000000-0000-4000-8000-000000000037', 'AutoHub Básico') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "PlanVersion" ("planId", "version", "status", "price", "currency", "interval", "organizationLimit", "userLimit", "workOrderLimit", "publishedAt")
SELECT "id", 1, 'PUBLISHED', 79.00, 'BRL', 'MONTHLY', 1, 3, NULL, CURRENT_TIMESTAMP FROM "Plan" WHERE "name" = 'AutoHub Básico'
  AND NOT EXISTS (SELECT 1 FROM "PlanVersion" pv WHERE pv."planId" = "Plan"."id" AND pv."version" = 1);

CREATE TABLE "CommercialAccount" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "billingEmail" TEXT,
  "billingDocument" TEXT,
  "primaryContactOrganizationId" UUID,
  "primaryContactUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommercialAccount_primaryContact_pair_check" CHECK (("primaryContactOrganizationId" IS NULL) = ("primaryContactUserId" IS NULL))
);
ALTER TABLE "CommercialAccount" ADD COLUMN "migrationOrganizationId" UUID;
CREATE INDEX "CommercialAccount_name_idx" ON "CommercialAccount"("name");
CREATE INDEX "CommercialAccount_primaryContactUserId_idx" ON "CommercialAccount"("primaryContactUserId");

ALTER TABLE "Organization" ADD COLUMN "commercialAccountId" UUID;
CREATE INDEX "Organization_commercialAccountId_idx" ON "Organization"("commercialAccountId");
CREATE UNIQUE INDEX "Organization_commercialAccountId_id_key" ON "Organization"("commercialAccountId", "id");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_commercialAccountId_fkey"
  FOREIGN KEY ("commercialAccountId") REFERENCES "CommercialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD COLUMN "commercialAccountId" UUID;
CREATE INDEX "Subscription_commercialAccountId_idx" ON "Subscription"("commercialAccountId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_commercialAccountId_fkey"
  FOREIGN KEY ("commercialAccountId") REFERENCES "CommercialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "User_organizationId_id_key" ON "User"("organizationId", "id");

INSERT INTO "CommercialAccount" ("name", "billingEmail", "billingDocument", "migrationOrganizationId")
SELECT 'Conta comercial — ' || o."name", o."email", o."document", o."id"
FROM "Organization" o;

UPDATE "Organization" o
SET "commercialAccountId" = ca."id"
FROM "CommercialAccount" ca
WHERE ca."migrationOrganizationId" = o."id";

UPDATE "CommercialAccount" ca
SET "primaryContactOrganizationId" = org."id",
    "primaryContactUserId" = u."id"
FROM "Organization" org
JOIN LATERAL (
  SELECT u0."id"
  FROM "User" u0
  WHERE u0."organizationId" = org."id" AND u0."role" = 'ADMIN' AND u0."status" = 'ACTIVE'
  ORDER BY u0."createdAt" ASC, u0."id" ASC
  LIMIT 1
) u ON TRUE
WHERE org."commercialAccountId" = ca."id";

ALTER TABLE "CommercialAccount" ADD CONSTRAINT "CommercialAccount_primaryContactOrganization_fkey"
  FOREIGN KEY ("id", "primaryContactOrganizationId") REFERENCES "Organization"("commercialAccountId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialAccount" ADD CONSTRAINT "CommercialAccount_primaryContactUser_fkey"
  FOREIGN KEY ("primaryContactOrganizationId", "primaryContactUserId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Subscription" ("commercialAccountId", "planVersionId", "status")
SELECT ca."id", pv."id", 'SCHEDULED'
FROM "CommercialAccount" ca
JOIN "PlanVersion" pv ON pv."version" = 1 AND pv."status" = 'PUBLISHED'
JOIN "Plan" p ON p."id" = pv."planId" AND p."name" = 'AutoHub Básico';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CommercialAccount" ca WHERE NOT EXISTS (
    SELECT 1 FROM "Subscription" s WHERE s."commercialAccountId" = ca."id"
  )) THEN
    RAISE EXCEPTION 'Published AutoHub Básico Plan Version is required to migrate Commercial Accounts';
  END IF;
END $$;

ALTER TABLE "CommercialAccount" DROP COLUMN "migrationOrganizationId";

CREATE TYPE "OrganizationOperationalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

ALTER TABLE "Organization" ADD COLUMN "operationalStatus" "OrganizationOperationalStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "Organization"
SET "operationalStatus" = CASE WHEN "active" THEN 'ACTIVE'::"OrganizationOperationalStatus" ELSE 'INACTIVE'::"OrganizationOperationalStatus" END;

DROP INDEX "Organization_active_idx";
ALTER TABLE "Organization" DROP COLUMN "active";
CREATE INDEX "Organization_operationalStatus_idx" ON "Organization"("operationalStatus");

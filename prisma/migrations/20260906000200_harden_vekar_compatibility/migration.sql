-- Resolve the legacy Basic Plan by its durable business name when installations
-- did not retain the canonical seed UUID.
UPDATE "Plan"
SET "code" = 'BASIC'
WHERE "code" IS NULL
  AND "name" = 'AutoHub Básico';

-- A consent linked to a user must link that user in the same organization.
ALTER TABLE "ConsentRecord"
  DROP CONSTRAINT "ConsentRecord_userId_fkey";

ALTER TABLE "ConsentRecord"
  ADD CONSTRAINT "ConsentRecord_userId_organizationId_fkey"
  FOREIGN KEY ("organizationId", "userId")
  REFERENCES "User"("organizationId", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

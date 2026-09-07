-- The canonical legacy Plan UUID is the durable migration identifier. Never
-- infer commercial identity from the mutable display name: an installation
-- with a different identifier must be reviewed instead of silently assigning
-- BASIC to an unrelated Plan.
UPDATE "Plan"
SET "code" = 'BASIC'
WHERE "id" = '00000000-0000-4000-8000-000000000037'
  AND "code" IS NULL;

DO $$
DECLARE
  canonical_basic_id uuid := '00000000-0000-4000-8000-000000000037';
  existing_basic_id uuid;
BEGIN
  SELECT "id" INTO existing_basic_id FROM "Plan" WHERE "code" = 'BASIC';
  IF existing_basic_id IS NULL THEN
    RAISE EXCEPTION 'Vekar Basic Plan identifier could not be verified; review the legacy Plan UUID before release';
  END IF;
  IF existing_basic_id <> canonical_basic_id THEN
    RAISE EXCEPTION 'Vekar Basic Plan code belongs to an unexpected identifier; review the legacy Plan UUID before release';
  END IF;
END $$;

-- A consent linked to a user must link that user in the same organization.
ALTER TABLE "ConsentRecord"
  DROP CONSTRAINT "ConsentRecord_userId_fkey";

ALTER TABLE "ConsentRecord"
  ADD CONSTRAINT "ConsentRecord_userId_organizationId_fkey"
  FOREIGN KEY ("organizationId", "userId")
  REFERENCES "User"("organizationId", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

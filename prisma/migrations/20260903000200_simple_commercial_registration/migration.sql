DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Organization"
    WHERE "commercialAccountId" IS NOT NULL
    GROUP BY "commercialAccountId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one Organization per Commercial Account: incompatible existing records require manual regularization';
  END IF;
END $$;

CREATE UNIQUE INDEX "Organization_commercialAccountId_key"
  ON "Organization"("commercialAccountId");

ALTER TABLE "Organization" ADD COLUMN "notes" TEXT;

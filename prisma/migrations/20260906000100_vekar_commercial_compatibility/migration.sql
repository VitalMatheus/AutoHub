ALTER TABLE "Plan" ADD COLUMN "code" TEXT;

UPDATE "Plan"
SET "code" = 'BASIC'
WHERE "id" = '00000000-0000-4000-8000-000000000037'
  AND "code" IS NULL;

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_USE', 'PRIVACY_POLICY', 'PROMOTIONAL');

CREATE TABLE "ConsentRecord" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "userId" UUID,
  "organizationId" UUID,
  "type" "ConsentType" NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "acceptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestIp" VARCHAR(64),
  "userAgent" TEXT,
  "context" VARCHAR(80),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ConsentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ConsentRecord_userId_type_acceptedAt_idx" ON "ConsentRecord"("userId", "type", "acceptedAt");
CREATE INDEX "ConsentRecord_organizationId_acceptedAt_idx" ON "ConsentRecord"("organizationId", "acceptedAt");

CREATE TABLE "TrialEligibilityRecord" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "documentFingerprint" VARCHAR(128) NOT NULL,
  "emailFingerprint" VARCHAR(128) NOT NULL,
  "trialStartedAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrialEligibilityRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrialEligibilityRecord_documentFingerprint_key" ON "TrialEligibilityRecord"("documentFingerprint");
CREATE UNIQUE INDEX "TrialEligibilityRecord_emailFingerprint_key" ON "TrialEligibilityRecord"("emailFingerprint");

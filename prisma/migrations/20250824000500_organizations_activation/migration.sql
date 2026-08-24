-- CreateEnum
CREATE TYPE "ActionTokenPurpose" AS ENUM ('ACTIVATE_ACCOUNT');

ALTER TABLE "Organization" ADD COLUMN "document" TEXT;
ALTER TABLE "Organization" ADD COLUMN "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN "email" TEXT;
ALTER TABLE "Organization" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Organization" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Organization" ADD COLUMN "city" TEXT;
ALTER TABLE "Organization" ADD COLUMN "state" TEXT;
ALTER TABLE "Organization" ADD COLUMN "postalCode" TEXT;
CREATE UNIQUE INDEX "Organization_document_key" ON "Organization"("document");

-- CreateTable
CREATE TABLE "ActionToken" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "purpose" "ActionTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionToken_tokenHash_key" ON "ActionToken"("tokenHash");
CREATE INDEX "ActionToken_userId_purpose_usedAt_idx" ON "ActionToken"("userId", "purpose", "usedAt");
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

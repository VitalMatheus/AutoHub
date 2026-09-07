CREATE TYPE "AcquisitionFunnelStage" AS ENUM (
  'REGISTRATION_STARTED',
  'EMAIL_CONFIRMED',
  'TRIAL_ACTIVE',
  'TRIAL_EXPIRED',
  'SUBSCRIBED'
);

CREATE TABLE "AcquisitionFunnelEvent" (
  "id" UUID NOT NULL,
  "stage" "AcquisitionFunnelStage" NOT NULL,
  "subjectKey" VARCHAR(64) NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AcquisitionFunnelEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcquisitionFunnelEvent_stage_subjectKey_key"
  ON "AcquisitionFunnelEvent" ("stage", "subjectKey");

CREATE INDEX "AcquisitionFunnelEvent_stage_occurredAt_idx"
  ON "AcquisitionFunnelEvent" ("stage", "occurredAt");

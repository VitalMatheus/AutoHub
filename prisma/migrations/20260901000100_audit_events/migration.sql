CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');

CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "actorType" "AuditActorType" NOT NULL,
    "actorUserId" UUID,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "commercialAccountId" UUID,
    "organizationId" UUID,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AuditEvent_occurredAt_id_idx" ON "AuditEvent"("occurredAt", "id");
CREATE INDEX "AuditEvent_actorUserId_occurredAt_id_idx" ON "AuditEvent"("actorUserId", "occurredAt", "id");
CREATE INDEX "AuditEvent_action_occurredAt_id_idx" ON "AuditEvent"("action", "occurredAt", "id");
CREATE INDEX "AuditEvent_targetType_targetId_occurredAt_id_idx" ON "AuditEvent"("targetType", "targetId", "occurredAt", "id");
CREATE INDEX "AuditEvent_organizationId_occurredAt_id_idx" ON "AuditEvent"("organizationId", "occurredAt", "id");
CREATE INDEX "AuditEvent_commercialAccountId_occurredAt_id_idx" ON "AuditEvent"("commercialAccountId", "occurredAt", "id");

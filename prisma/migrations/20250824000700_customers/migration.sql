-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_organizationId_id_key" ON "Customer"("organizationId", "id");
CREATE UNIQUE INDEX "Customer_organizationId_document_key" ON "Customer"("organizationId", "document");
CREATE INDEX "Customer_organizationId_active_name_id_idx" ON "Customer"("organizationId", "active", "name", "id");
CREATE INDEX "Customer_organizationId_phone_idx" ON "Customer"("organizationId", "phone");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

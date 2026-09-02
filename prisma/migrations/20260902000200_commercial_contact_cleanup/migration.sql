ALTER TABLE "CommercialAccount" DROP CONSTRAINT "CommercialAccount_primaryContactOrganization_fkey";
ALTER TABLE "CommercialAccount" DROP CONSTRAINT "CommercialAccount_primaryContactUser_fkey";

ALTER TABLE "CommercialAccount" ADD CONSTRAINT "CommercialAccount_primaryContactOrganization_fkey"
  FOREIGN KEY ("id", "primaryContactOrganizationId") REFERENCES "Organization"("commercialAccountId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialAccount" ADD CONSTRAINT "CommercialAccount_primaryContactUser_fkey"
  FOREIGN KEY ("primaryContactOrganizationId", "primaryContactUserId") REFERENCES "User"("organizationId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

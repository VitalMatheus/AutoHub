# Scope tenant access explicitly in Services

Every Service operation on tenant-owned data includes the authenticated User’s `organizationId` in its Prisma query, while Guards handle authentication and role checks and database constraints prevent cross-tenant relationships. We prefer this visible enforcement over implicit Prisma middleware because explicit scoping is easier to review and test, accepting a small amount of repetition in exchange for a clearer security boundary.

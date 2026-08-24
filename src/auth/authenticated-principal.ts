import { UserRole } from '@prisma/client';

export type AuthenticatedPrincipal = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
};

export type AccessTokenPayload = {
  sub: string;
  sid: string;
};

export const PRINCIPAL_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  organizationId: true,
} as const;

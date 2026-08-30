export type UserRole = 'SUPER_ADMIN' | 'ADMIN';

export type Principal = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
};

export type AccessTokens = {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
};

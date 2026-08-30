import { createContext, useContext } from 'react';
import type { Principal } from '@/shared/types/auth';

export type AuthContextValue = {
  principal: Principal | null;
  isAuthenticated: boolean;
  isSigningIn: boolean;
  isRestoring: boolean;
  signIn: (email: string, password: string) => Promise<Principal>;
  signOut: () => Promise<void>;
};

export function getHomePath(role: Principal['role']): '/app' | '/platform' {
  return role === 'SUPER_ADMIN' ? '/platform' : '/app';
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

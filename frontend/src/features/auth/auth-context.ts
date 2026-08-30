import { createContext, useContext } from 'react';
import type { Principal } from '@/shared/types/auth';

export type AuthContextValue = {
  principal: Principal | null;
  isAuthenticated: boolean;
  isSigningIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

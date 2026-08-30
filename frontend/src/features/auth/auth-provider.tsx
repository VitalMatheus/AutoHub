import { useState, type PropsWithChildren } from 'react';
import { ApiError, setAccessToken } from '@/shared/api/http';
import type { Principal } from '@/shared/types/auth';
import { getCurrentPrincipal, login } from './api/auth-api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function signIn(email: string, password: string): Promise<void> {
    setIsSigningIn(true);
    try {
      const tokens = await login(email, password);
      setAccessToken(tokens.accessToken);
      const currentPrincipal = await getCurrentPrincipal();
      setPrincipal(currentPrincipal);
    } catch (error) {
      setAccessToken(null);
      setPrincipal(null);
      if (error instanceof ApiError) throw error;
      throw new ApiError({ status: 0, detail: 'Não foi possível entrar agora.', code: 'AUTHENTICATION_ERROR' });
    } finally {
      setIsSigningIn(false);
    }
  }

  return <AuthContext.Provider value={{ principal, isAuthenticated: principal !== null, isSigningIn, signIn }}>{children}</AuthContext.Provider>;
}

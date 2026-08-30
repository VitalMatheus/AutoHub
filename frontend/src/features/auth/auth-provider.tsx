import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ApiError, setAccessToken, setRefreshAccessTokenHandler, setRefreshFailureHandler } from '@/shared/api/http';
import type { Principal } from '@/shared/types/auth';
import { getCurrentPrincipal, login, logout, refresh } from './api/auth-api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const restorationStarted = useRef(false);

  useEffect(() => {
    const refreshAccessToken = async (): Promise<string> => {
      const tokens = await refresh();
      setAccessToken(tokens.accessToken);
      return tokens.accessToken;
    };

    setRefreshAccessTokenHandler(refreshAccessToken);
    setRefreshFailureHandler(() => {
      setAccessToken(null);
      setPrincipal(null);
    });
    if (restorationStarted.current) return () => {
      setRefreshAccessTokenHandler(null);
      setRefreshFailureHandler(null);
    };
    restorationStarted.current = true;

    void refreshAccessToken()
      .then(() => getCurrentPrincipal())
      .then(setPrincipal)
      .catch(() => {
        setAccessToken(null);
        setPrincipal(null);
      })
      .finally(() => setIsRestoring(false));

    return () => {
      setRefreshAccessTokenHandler(null);
      setRefreshFailureHandler(null);
    };
  }, []);

  async function signIn(email: string, password: string): Promise<Principal> {
    setIsSigningIn(true);
    try {
      const tokens = await login(email, password);
      setAccessToken(tokens.accessToken);
      const currentPrincipal = await getCurrentPrincipal();
      setPrincipal(currentPrincipal);
      return currentPrincipal;
    } catch (error) {
      setAccessToken(null);
      setPrincipal(null);
      if (error instanceof ApiError) throw error;
      throw new ApiError({ status: 0, detail: 'Não foi possível entrar agora.', code: 'AUTHENTICATION_ERROR' });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function signOut(): Promise<void> {
    try {
      await logout();
    } catch {
      // Local state is cleared even if the network request cannot complete.
    } finally {
      setAccessToken(null);
      setPrincipal(null);
    }
  }

  return <AuthContext.Provider value={{ principal, isAuthenticated: principal !== null, isSigningIn, isRestoring, signIn, signOut }}>{children}</AuthContext.Provider>;
}

import { httpClient } from '@/shared/api/http';
import type { AccessTokens, Principal } from '@/shared/types/auth';

export async function login(email: string, password: string): Promise<AccessTokens> {
  const response = await httpClient.post<AccessTokens>('/auth/login', { email, password });
  return response.data;
}

export async function getCurrentPrincipal(): Promise<Principal> {
  const response = await httpClient.get<Principal>('/auth/me');
  return response.data;
}

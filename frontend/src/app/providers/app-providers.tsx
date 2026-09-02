import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/auth-provider';
import { AppRouter } from '../router/app-router';

export function AppProviders() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));

  return <QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><AppRouter /></AuthProvider></BrowserRouter></QueryClientProvider>;
}

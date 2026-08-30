import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/auth-provider';
import { AppRouter } from '../router/app-router';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export function AppProviders() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><AppRouter /></AuthProvider></BrowserRouter></QueryClientProvider>;
}

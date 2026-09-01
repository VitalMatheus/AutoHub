import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHomePage } from '@/app/pages/app-home-page';
import { httpClient } from '@/shared/api/http';

describe('Dashboard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows API counters and enabled quick actions', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { customers: 8, openWorkOrders: 2, pendingQuotes: 5 } } as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/app/dashboard']}><AppHomePage /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Novo cliente/ })).toHaveAttribute('href', '/app/customers/new');
    expect(screen.getByRole('link', { name: /Novo veículo/ })).toHaveAttribute('href', '/app/vehicles/new');
    expect(screen.getByRole('link', { name: /Novo orçamento/ })).toHaveAttribute('href', '/app/quotes/new');
    expect(screen.getByRole('link', { name: /Nova ordem de serviço/ })).toHaveAttribute('href', '/app/work-orders/new');
    expect(screen.getByText('As atividades serão exibidas quando houver dados disponíveis.')).toBeInTheDocument();
  });
});

import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHomePage } from '@/app/pages/app-home-page';
import { PlatformHomePage } from '@/app/pages/platform-home-page';
import { httpClient } from '@/shared/api/http';

describe('Dashboard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows the customer count and marks unsupported dashboard metrics and actions as unavailable', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 1, total: 8, totalPages: 8 } } } as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/app/dashboard']}><AppHomePage /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(screen.getByText('Clientes cadastrados')).toBeInTheDocument();
    expect(screen.getByText('Veículos')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos')).toBeInTheDocument();
    expect(screen.getByText('Ordens de serviço')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getAllByText('Indisponível no dashboard')).toHaveLength(3);
    expect(screen.getAllByText('Em breve')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: /Novo veículo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Novo orçamento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Nova ordem de serviço/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Em breve/ })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /Em breve/ }).every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(screen.getByRole('link', { name: /Novo cliente/ })).toHaveAttribute('href', '/app/customers/new');
    expect(screen.getByText('As atividades serão exibidas quando houver dados disponíveis.')).toBeInTheDocument();
  });

  it('labels monthly cards with the reference month', async () => {
    const dashboard = { referenceAt: '2026-01-20T12:00:00.000Z', timezone: 'America/Recife', organizations: { total: 1, active: 1, inactive: 0, suspended: 0, commerciallyBlocked: 0 }, subscriptions: { trial: 0, paidCurrent: 1, awaitingFirstPayment: 0, delinquent: 0, effectivelyCancelled: 0, pendingCommercialSetup: 0 }, monthly: { newOrganizations: 0, newCommercialAccounts: 2, effectiveCancellations: 0, operationalDeactivations: 0 }, financial: { mrr: '79.00', receivedRevenue: '79.00', pendingRevenue: { upcoming: '0.00', overdue: '0.00', total: '0.00' } }, series: [{ month: '2025-02', mrr: '79.00', organizations: 1, receivedRevenue: '0.00', newOrganizations: 0, newCommercialAccounts: 0, effectiveCancellations: 0, operationalDeactivations: 0 }] };
    vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/dashboard' ? Promise.resolve({ data: dashboard }) as never : Promise.resolve({ data: { data: [] } }) as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><PlatformHomePage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findAllByText('Mês de referência: 01/2026')).toHaveLength(2);
  });
});

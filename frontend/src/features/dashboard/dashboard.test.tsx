import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHomePage } from '@/app/pages/app-home-page';
import { PlatformHomePage } from '@/app/pages/platform-home-page';
import { httpClient } from '@/shared/api/http';

describe('Dashboard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows the trial notice in Portuguese and dismisses it for the current day', async () => {
    localStorage.clear();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { referenceAt: '2026-01-20T12:00:00.000Z', timezone: 'America/Recife', organization: { id: 'org-1', name: 'Oficina' }, trial: { status: 'ACTIVE', endsAt: '2026-01-25T12:00:00.000Z', remainingDays: 5, message: 'Trial Period ends in 5 days' }, metrics: { customers: 0, vehicles: 0, quotes: 0, workOrders: 0 }, activities: [] } } as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><AppHomePage /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('Seu período de teste termina em 5 dias.')).toBeInTheDocument();
    expect(screen.queryByText('Trial Period ends in 5 days')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso do período de teste' }));
    expect(screen.queryByRole('region', { name: 'Status do período de teste' })).not.toBeInTheDocument();
  });

  it('shows live operational metrics, recent activities and quick-action links', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { metrics: { customers: 8, vehicles: 5, quotes: 3, workOrders: 2 }, activities: [{ type: 'CUSTOMER_CREATED', label: 'Cliente cadastrado', description: 'Maria', occurredAt: '2026-01-20T12:00:00.000Z', href: '/app/customers/customer-1' }] } } as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/app/dashboard']}><AppHomePage /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Clientes cadastrados')).toBeInTheDocument();
    expect(screen.getByText('Veículos')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos')).toBeInTheDocument();
    expect(screen.getByText('Rascunhos e pendentes')).toBeInTheDocument();
    expect(screen.getByText('Ordens de serviço')).toBeInTheDocument();
    expect(screen.getByText('Em aberto')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Novo veículo/ })).toHaveAttribute('href', '/app/vehicles/new');
    expect(screen.getByRole('link', { name: /Novo orçamento/ })).toHaveAttribute('href', '/app/quotes/new');
    expect(screen.getByRole('link', { name: /Nova ordem de serviço/ })).toHaveAttribute('href', '/app/work-orders/new');
    expect(screen.getByRole('link', { name: /Novo cliente/ })).toHaveAttribute('href', '/app/customers/new');
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.queryByText('Primeiros passos')).not.toBeInTheDocument();
    expect(screen.queryByText('Encerrar Subscription')).not.toBeInTheDocument();
  });

  it('shows reduced commercial metrics, attention links and no historical series', async () => {
    const dashboard = { referenceAt: '2026-01-20T12:00:00.000Z', timezone: 'America/Recife', organizations: { total: 3, current: 1, dueSoon: 1, overdue: 1, paymentBlocked: 1, suspended: 1 }, financial: { receivedRevenue: '79.00', openWithinDue: '20.00', overdue: '100.00' }, attentionOrganizations: [{ id: 'org-1', name: 'Oficina Central', reasons: ['OVERDUE'] }] };
    vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/dashboard' ? Promise.resolve({ data: dashboard }) as never : Promise.resolve({ data: { data: [] } }) as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><PlatformHomePage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('Oficina Central')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhe' })).toHaveAttribute('href', '/platform/organizations/org-1');
    expect(screen.getByText('Em aberto no prazo')).toBeInTheDocument();
    expect(screen.queryByText('MRR')).not.toBeInTheDocument();
    expect(screen.queryByText('Evolução do MRR')).not.toBeInTheDocument();
  });
});

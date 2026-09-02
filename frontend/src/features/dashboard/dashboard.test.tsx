import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHomePage } from '@/app/pages/app-home-page';
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
});

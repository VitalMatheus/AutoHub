import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpClient } from '@/shared/api/http';
import { ReportsPage } from './pages/reports-page';

describe('Reports page', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders the period controls and managerial report', async () => {
    const get = vi.spyOn(httpClient, 'get');
    vi.mocked(get).mockResolvedValue({ data: { from: '2026-09-01', to: '2026-09-30', timezone: 'America/Recife', revenue: { workOrders: '100.00', directSales: '50.00', total: '150.00' }, realizedExpenses: { total: '30.00', byCategory: [] }, cashResult: '120.00', grossProfit: '150.00', operatingProfit: '120.00', partsGrossMargin: { sales: '0.00', cost: null, margin: null, traceable: false }, accountsReceivable: [], accountsPayable: [], monthlyComparison: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ReportsPage /></QueryClientProvider>);

    expect(screen.getByRole('heading', { name: 'Relatórios gerenciais' })).toBeInTheDocument();
    expect(await screen.findByText('Resultado de caixa')).toBeInTheDocument();
    expect(screen.getByLabelText('Período')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/reports/managerial', expect.anything());
  });
});

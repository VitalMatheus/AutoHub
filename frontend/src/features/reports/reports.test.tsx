import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpClient } from '@/shared/api/http';
import { ReportsPage } from './pages/reports-page';

const report = { from: '2026-09-01', to: '2026-09-30', timezone: 'America/Recife', revenue: { workOrders: '100.00', directSales: '50.00', total: '150.00' }, realizedExpenses: { total: '30.00', byCategory: [{ category: 'RENT', amount: '30.00' }] }, cashResult: '120.00', grossProfit: '150.00', operatingProfit: '120.00', partsGrossMargin: { sales: '0.00', cost: null, margin: null, traceable: false }, accountsReceivable: [{ source: 'WORK_ORDER', id: 'wo-1', number: 10, balance: '20.00' }], accountsPayable: [{ id: 'expense-1', description: 'Aluguel', category: 'RENT', dueDate: '2026-09-20', balance: '10.00' }], monthlyComparison: [{ month: '2026-09', revenue: '150.00', expenses: '30.00', cashResult: '120.00' }] };

describe('Reports page', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders the period controls and managerial report', async () => {
    const get = vi.spyOn(httpClient, 'get');
    vi.mocked(get).mockResolvedValue({ data: { from: '2026-09-01', to: '2026-09-30', timezone: 'America/Recife', revenue: { workOrders: '100.00', directSales: '50.00', total: '150.00' }, realizedExpenses: { total: '30.00', byCategory: [] }, cashResult: '120.00', grossProfit: '150.00', operatingProfit: '120.00', partsGrossMargin: { sales: '0.00', cost: null, margin: null, traceable: false }, accountsReceivable: [], accountsPayable: [], monthlyComparison: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ReportsPage /></QueryClientProvider>);

    expect(screen.getByRole('heading', { name: 'Relatórios gerenciais' })).toBeInTheDocument();
    expect(await screen.findByText('Resultado de caixa')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Período' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/reports/managerial', expect.anything());
  });

  it('shows explanations after a delayed hover and keyboard focus', async () => {
    const get = vi.spyOn(httpClient, 'get');
    vi.mocked(get).mockResolvedValue({ data: { from: '2026-09-01', to: '2026-09-30', timezone: 'America/Recife', revenue: { workOrders: '100.00', directSales: '50.00', total: '150.00' }, realizedExpenses: { total: '30.00', byCategory: [] }, cashResult: '120.00', grossProfit: '150.00', operatingProfit: '120.00', partsGrossMargin: { sales: '0.00', cost: null, margin: null, traceable: false }, accountsReceivable: [], accountsPayable: [], monthlyComparison: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ReportsPage /></QueryClientProvider>);
    await screen.findByText('Resultado de caixa');
    vi.useFakeTimers();

    const label = screen.getByLabelText('Receita realizada');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(label);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Total recebido de OS e vendas de balcão no período.');
    fireEvent.mouseLeave(label);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(label);
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(label);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('downloads a PDF using the selected period and workshop name', async () => {
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url, config) => Promise.resolve({ data: url === '/account/dashboard' ? { organization: { id: 'org-1', name: 'Oficina Central' } } : { ...report, from: (config as { params?: { from?: string } })?.params?.from ?? report.from, to: (config as { params?: { to?: string } })?.params?.to ?? report.to } }) as never);
    let downloadedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => { downloadedBlob = blob; return 'blob:report'; });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ReportsPage /></QueryClientProvider>);

    await screen.findByText('Resultado de caixa');
    fireEvent.change(screen.getByRole('combobox', { name: 'Período' }), { target: { value: 'custom' } });
    fireEvent.change(screen.getByDisplayValue('2026-09-01'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByDisplayValue('2026-09-30'), { target: { value: '2026-08-31' } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/reports/managerial', { params: { from: '2026-08-01', to: '2026-08-31' } }));
    const button = screen.getByRole('button', { name: 'Exportar PDF' });
    await waitFor(() => expect(button).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(button);
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();

    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/pdf' }));
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
    const pdfText = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(downloadedBlob!); });
    expect(pdfText).toContain('GERENCIAL');
    expect(pdfText).toContain('Oficina Central');
    expect(pdfText).toContain('01/08/2026 a 31/08/2026');
  });
});

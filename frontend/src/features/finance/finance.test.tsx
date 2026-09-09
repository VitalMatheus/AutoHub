import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { FinanceExpensePage, FinanceIndexPage, FinancePage } from './pages/finance-page';
import { cancelPayment, createPayment, listPayments } from './api/payments-api';

const workOrder = { id: 'wo-1', number: 42, status: 'IN_PROGRESS', total: '100.00' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/finance/work-orders/wo-1']}><Routes><Route path="/app/finance/work-orders/:workOrderId" element={<FinancePage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

function renderExpensePage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/finance/expenses/expense-1']}><Routes><Route path="/app/finance/expenses/:expenseId" element={<FinanceExpensePage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('Finance payment registration', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers an exact decimal Payment against the Work Order endpoint without tenant data', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url.endsWith('/payments') ? { data: [], financial: { total: '100.00', paid: '0.00', balance: '100.00', status: 'UNPAID' } } : { ...workOrder, items: [] } }) as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { id: 'payment-1', amount: '35.10', method: 'PIX', status: 'CONFIRMED', paidAt: '2026-01-01T10:00:00.000Z', createdAt: '2026-01-01T10:00:00.000Z', financial: { total: '100.00', paid: '35.10', balance: '64.90', status: 'PARTIAL' } } } as never);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Financeiro da OS #42' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Voltar para Financeiro' })).toHaveAttribute('href', '/app/finance');
    await user.type(await screen.findByLabelText('Valor'), '35,10');
    await user.clear(screen.getByLabelText('Desconto'));
    await user.type(screen.getByLabelText('Desconto'), '5,00');
    await user.selectOptions(screen.getByLabelText('Método'), 'PIX');
    await user.click(screen.getByRole('button', { name: 'Registrar pagamento' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/work-orders/wo-1/payments', expect.objectContaining({ amount: '35.10', discount: '5.00', method: 'PIX', status: 'CONFIRMED', paidAt: expect.any(String) })));
    expect(JSON.stringify(post.mock.calls)).not.toContain('organizationId');
    expect(await screen.findByRole('status')).toHaveTextContent('Pagamento registrado.');
  });

  it('keeps all Payment operations under the nested Work Order endpoints', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], financial: { total: '0.00', paid: '0.00', balance: '0.00', status: 'UNPAID' } } } as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: {} } as never);
    await listPayments('wo-1');
    await createPayment('wo-1', { amount: '10.00', method: 'CASH', paidAt: '2026-01-01T10:00:00.000Z' });
    await cancelPayment('wo-1', 'payment-1');
    expect(get).toHaveBeenCalledWith('/work-orders/wo-1/payments');
    expect(post).toHaveBeenNthCalledWith(1, '/work-orders/wo-1/payments', { amount: '10.00', method: 'CASH', paidAt: '2026-01-01T10:00:00.000Z' });
    expect(post).toHaveBeenNthCalledWith(2, '/work-orders/wo-1/payments/payment-1/cancel');
    expect(JSON.stringify({ get: get.mock.calls, post: post.mock.calls })).not.toContain('organizationId');
  });

  it('rejects invalid decimal amounts before calling the API', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url.endsWith('/payments') ? { data: [], financial: { total: '100.00', paid: '0.00', balance: '100.00', status: 'UNPAID' } } : { ...workOrder, items: [] } }) as never);
    const post = vi.spyOn(httpClient, 'post');
    renderPage();
    await user.type(await screen.findByLabelText('Valor'), '12.345');
    await user.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe um valor decimal válido.');
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the derived financial state and cancels a Payment through the explicit action', async () => {
    const user = userEvent.setup();
    const payment = { id: 'payment-1', amount: '35.10', method: 'PIX', status: 'CONFIRMED', paidAt: '2026-01-01T10:00:00.000Z', createdAt: '2026-01-01T10:00:00.000Z', financial: { total: '100.00', paid: '35.10', balance: '64.90', status: 'PARTIAL' } };
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url.endsWith('/payments') ? { data: [payment], financial: payment.financial } : { ...workOrder, items: [] } }) as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...payment, status: 'CANCELLED', financial: { total: '100.00', paid: '0.00', balance: '100.00', status: 'UNPAID' } } } as never);
    renderPage();
    expect(await screen.findByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('R$ 64,90')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/work-orders/wo-1/payments/payment-1/cancel'));
  });

  it('does not offer new payments for a cancelled Work Order', async () => {
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url.endsWith('/payments') ? { data: [{ id: 'payment-1', amount: '10.00', method: 'PIX', status: 'CONFIRMED', paidAt: null, createdAt: '2026-01-01T10:00:00.000Z' }], financial: { total: '100.00', paid: '10.00', balance: '90.00', status: 'PARTIAL' } } : { ...workOrder, status: 'CANCELLED', items: [] } }) as never);
    renderPage();
    await screen.findByText('Parcial');
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });
});

describe('Finance Work Order list', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads operational and financial fields through the dedicated endpoint', async () => {
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url === '/expenses' ? { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } : { data: [{ ...workOrder, customer: { name: 'Maria Silva' }, vehicle: { brand: 'Toyota', model: 'Corolla', plate: 'ABC1D23' }, financial: { total: '100.00', paid: '35.10', balance: '64.90', status: 'PARTIAL' } }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><FinanceIndexPage /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Toyota Corolla · ABC1D23')).toBeInTheDocument();
    expect(screen.getByText('Em execução')).toBeInTheDocument();
    expect(screen.getByText('R$ 100,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 35,10')).toBeInTheDocument();
    expect(screen.getByText('R$ 64,90')).toBeInTheDocument();
    expect(screen.getAllByText('Parcial')).toHaveLength(2);
    expect(httpClient.get).toHaveBeenCalledWith('/work-orders/financial', { params: { page: 1, pageSize: 100 } });
  });

  it('filters Work Orders by financial status and customer, vehicle or number', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url === '/expenses' ? { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } : { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } }) as never);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><FinanceIndexPage /></MemoryRouter></QueryClientProvider>);

    const search = await screen.findByLabelText('Buscar por número, cliente ou veículo');
    fireEvent.change(search, { target: { value: 'Maria' } });
    await user.selectOptions(await screen.findByLabelText('Filtrar por situação financeira'), 'PARTIAL');

    await waitFor(() => expect(get).toHaveBeenCalledWith('/work-orders/financial', { params: { page: 1, pageSize: 100, financialStatus: 'PARTIAL', search: 'Maria' } }));
  });

  it('creates an Expense from the Finance page without tenant data', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url === '/expenses' ? { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } : { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } }) as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { id: 'expense-1' } } as never);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><FinanceIndexPage /></MemoryRouter></QueryClientProvider>);

    await screen.findByRole('heading', { name: 'Nova despesa' });
    await user.selectOptions(screen.getByLabelText('Categoria da despesa'), 'RENT');
    await user.type(screen.getByLabelText('Descrição da despesa'), 'Aluguel');
    await user.type(screen.getByLabelText('Valor da despesa'), '1200,00');
    await user.click(screen.getByRole('button', { name: 'Cadastrar despesa' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/expenses', { category: 'RENT', description: 'Aluguel', amount: '1200.00', dueDate: expect.any(String) }));
    expect(JSON.stringify(post.mock.calls)).not.toContain('organizationId');
    expect(get).toHaveBeenCalledWith('/expenses', { params: { page: 1, pageSize: 100 } });
  });
});

describe('Finance Expense payments', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers an Expense payment without the Work Order-only discount field', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url.endsWith('/payments') ? { data: [], financial: { total: '100.00', paid: '0.00', balance: '100.00', status: 'UNPAID' } } : { id: 'expense-1', description: 'Aluguel', category: 'RENT', amount: '100.00', paid: '0.00', balance: '100.00', financialStatus: 'UNPAID', status: 'OPEN', dueDate: '2026-01-10', payments: [] } }) as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { id: 'payment-1' } } as never);
    renderExpensePage();

    expect(await screen.findByRole('heading', { name: 'Aluguel' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Desconto')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Valor'), '100,00');
    await user.click(screen.getByRole('button', { name: 'Registrar pagamento' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/expenses/expense-1/payments', { amount: '100.00', method: 'PIX', status: 'CONFIRMED', paidAt: expect.any(String) }));
  });
});

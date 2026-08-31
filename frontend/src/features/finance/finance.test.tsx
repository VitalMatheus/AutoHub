import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { FinancePage } from './pages/finance-page';
import { cancelPayment, createPayment, listPayments } from './api/payments-api';

const workOrder = { id: 'wo-1', number: 42, status: 'IN_PROGRESS', total: '100.00' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/finance/work-orders/wo-1']}><Routes><Route path="/app/finance/work-orders/:workOrderId" element={<FinancePage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('Finance payment registration', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers an exact decimal Payment against the Work Order endpoint without tenant data', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url.endsWith('/payments') ? { data: [], financial: { total: '100.00', paid: '0.00', balance: '100.00', status: 'UNPAID' } } : { ...workOrder, items: [] } }) as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { id: 'payment-1', amount: '35.10', method: 'PIX', status: 'CONFIRMED', paidAt: '2026-01-01T10:00:00.000Z', createdAt: '2026-01-01T10:00:00.000Z', financial: { total: '100.00', paid: '35.10', balance: '64.90', status: 'PARTIAL' } } } as never);
    renderPage();

    await user.type(await screen.findByLabelText('Valor'), '35.10');
    await user.selectOptions(screen.getByLabelText('Método'), 'PIX');
    await user.click(screen.getByRole('button', { name: 'Registrar pagamento' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/work-orders/wo-1/payments', expect.objectContaining({ amount: '35.10', method: 'PIX', status: 'CONFIRMED', paidAt: expect.any(String) })));
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
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url.endsWith('/payments') ? { data: [], financial: { total: '100.00', paid: '0.00', balance: '100.00', status: 'UNPAID' } } : { ...workOrder, status: 'CANCELLED', items: [] } }) as never);
    renderPage();
    await screen.findByText('Não pago');
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
  });
});

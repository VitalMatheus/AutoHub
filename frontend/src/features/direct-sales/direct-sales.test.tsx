import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectSaleDetailPage, NewDirectSalePage } from './pages/direct-sale-pages';
import type { DirectSale } from './api/direct-sales-api';
import { addSalePayment, confirmDirectSale, createDirectSale, getDirectSale, updateDirectSale } from './api/direct-sales-api';
import { ApiError } from '@/shared/api/http';
import { listCustomers } from '@/features/customers/api/customers-api';
import { listProducts } from '@/features/products/api/products-api';

vi.mock('./api/direct-sales-api', async () => {
  const actual = await vi.importActual<typeof import('./api/direct-sales-api')>('./api/direct-sales-api');
  return { ...actual, addSalePayment: vi.fn(), cancelDirectSale: vi.fn(), confirmDirectSale: vi.fn(), createDirectSale: vi.fn(), getDirectSale: vi.fn(), updateDirectSale: vi.fn() };
});

vi.mock('@/features/customers/api/customers-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/customers/api/customers-api')>('@/features/customers/api/customers-api');
  return { ...actual, listCustomers: vi.fn() };
});

vi.mock('@/features/products/api/products-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/products/api/products-api')>('@/features/products/api/products-api');
  return { ...actual, listProducts: vi.fn() };
});

const draft: DirectSale = {
  id: 'sale-1', number: 12, customer: null, status: 'DRAFT', total: '100.00',
  items: [{ id: 'item-1', productId: 'product-1', productName: 'Filtro', quantity: 1, unitPrice: '100.00', discount: '0.00', lineTotal: '100.00' }],
  payments: [], financial: { total: '100.00', paid: '0.00', balance: '100.00', status: 'UNPAID' },
};
const confirmed: DirectSale = { ...draft, status: 'CONFIRMED', financial: { ...draft.financial, paid: '100.00', balance: '0.00', status: 'PAID' } };
const partiallyPaid: DirectSale = { ...draft, customer: { id: 'customer-1', name: 'Cliente' }, status: 'CONFIRMED', financial: { ...draft.financial, paid: '20.00', balance: '80.00', status: 'PARTIAL' } };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/app/direct-sales/sale-1']}><Routes><Route path="/app/direct-sales/:id" element={<DirectSaleDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

function apiError() {
  return new ApiError({ status: 409, detail: 'database secret', code: 'CONFLICT' });
}

describe('DirectSaleDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends only one confirmation while the request is pending and updates the sale', async () => {
    let current = draft;
    let resolveConfirmation!: (sale: DirectSale) => void;
    vi.mocked(getDirectSale).mockImplementation(async () => current);
    vi.mocked(confirmDirectSale).mockImplementation(() => new Promise(resolve => { resolveConfirmation = sale => { current = sale; resolve(sale); }; }));

    renderPage();
    const button = await screen.findByRole('button', { name: /confirmar e baixar estoque/i });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(confirmDirectSale).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();

    resolveConfirmation(confirmed);
    await waitFor(() => expect(screen.getByText('Confirmada')).toBeInTheDocument());
    expect(screen.queryByText('CONFIRMED')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /emitir comprovante não fiscal/i })).toBeInTheDocument();
  });

  it('does not show the non-fiscal receipt before the sale is confirmed', async () => {
    vi.mocked(getDirectSale).mockResolvedValue(draft);

    renderPage();

    await screen.findByRole('button', { name: /confirmar e baixar estoque/i });
    expect(screen.queryByRole('link', { name: /emitir comprovante não fiscal/i })).not.toBeInTheDocument();
  });

  it('shows confirmation errors instead of leaving the page apparently unchanged', async () => {
    vi.mocked(getDirectSale).mockResolvedValue(draft);
    vi.mocked(confirmDirectSale).mockRejectedValue(apiError());

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /confirmar e baixar estoque/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir porque este registro já existe.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('database secret');
  });

  it('shows a safe API message when creating a sale fails', async () => {
    vi.mocked(listProducts).mockResolvedValue({ data: [{ id: 'product-1', name: 'Filtro', description: null, sku: 'F-1', salePrice: '100.00', stockQuantity: 1, stockMinimum: 0, lowStock: false, active: true, createdAt: '', updatedAt: '' }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } });
    vi.mocked(listCustomers).mockResolvedValue({ data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } });
    vi.mocked(createDirectSale).mockRejectedValue(apiError());

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/app/direct-sales/new']}><Routes><Route path="/app/direct-sales/new" element={<NewDirectSalePage />} /></Routes></MemoryRouter></QueryClientProvider>);

    const comboboxes = await screen.findAllByRole('combobox');
    fireEvent.change(comboboxes[1], { target: { value: 'product-1' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '100.00' } });
    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir porque este registro já existe.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('database secret');
  });

  it('shows a safe API message when adding a payment fails', async () => {
    vi.mocked(getDirectSale).mockResolvedValue(partiallyPaid);
    vi.mocked(addSalePayment).mockRejectedValue(apiError());

    renderPage();
    fireEvent.change(await screen.findByRole('textbox', { name: /valor do pagamento/i }), { target: { value: '80.00' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar pix/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir porque este registro já existe.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('database secret');
  });

  it('allows a discount on a draft before confirming the sale', async () => {
    let current = draft;
    const saved = { ...draft, total: '80.00', items: [{ ...draft.items[0], discount: '20.00', lineTotal: '80.00' }], financial: { ...draft.financial, total: '80.00', balance: '80.00' } };
    vi.mocked(getDirectSale).mockImplementation(async () => current);
    vi.mocked(updateDirectSale).mockImplementation(async () => { current = saved; return saved; });

    renderPage();

    const discount = await screen.findByRole('textbox', { name: /desconto de filtro/i });
    fireEvent.change(discount, { target: { value: '20.00' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar descontos/i }));

    await waitFor(() => expect(updateDirectSale).toHaveBeenCalledWith('sale-1', { items: [{ productId: 'product-1', quantity: 1, unitPrice: '100.00', discount: '20.00' }] }));
    expect(await screen.findByText('R$ 80,00')).toBeInTheDocument();
  });
});

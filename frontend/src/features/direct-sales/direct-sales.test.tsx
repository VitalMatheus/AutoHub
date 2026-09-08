import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectSaleDetailPage } from './pages/direct-sale-pages';
import type { DirectSale } from './api/direct-sales-api';
import { confirmDirectSale, getDirectSale, updateDirectSale } from './api/direct-sales-api';

vi.mock('./api/direct-sales-api', async () => {
  const actual = await vi.importActual<typeof import('./api/direct-sales-api')>('./api/direct-sales-api');
  return { ...actual, cancelDirectSale: vi.fn(), confirmDirectSale: vi.fn(), getDirectSale: vi.fn(), updateDirectSale: vi.fn() };
});

const draft: DirectSale = {
  id: 'sale-1', number: 12, customer: null, status: 'DRAFT', total: '100.00',
  items: [{ id: 'item-1', productId: 'product-1', productName: 'Filtro', quantity: 1, unitPrice: '100.00', discount: '0.00', lineTotal: '100.00' }],
  payments: [], financial: { total: '100.00', paid: '0.00', balance: '100.00', status: 'UNPAID' },
};
const confirmed: DirectSale = { ...draft, status: 'CONFIRMED', financial: { ...draft.financial, paid: '100.00', balance: '0.00', status: 'PAID' } };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/app/direct-sales/sale-1']}><Routes><Route path="/app/direct-sales/:id" element={<DirectSaleDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
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
    vi.mocked(confirmDirectSale).mockRejectedValue(new Error('Estoque insuficiente'));

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /confirmar e baixar estoque/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar a venda.');
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

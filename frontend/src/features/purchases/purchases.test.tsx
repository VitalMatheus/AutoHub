import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { NewPurchasePage } from './pages/purchase-pages';

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><NewPurchasePage /></MemoryRouter></QueryClientProvider>);
}

describe('Purchases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/suppliers') return Promise.resolve({ data: { data: [{ id: 'supplier-1', name: 'Fornecedor' }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } } }) as never;
      if (url === '/products') return Promise.resolve({ data: { data: [{ id: 'product-1', name: 'Produto', sku: 'PROD-1' }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      return Promise.reject(new Error(`Unexpected ${url}`));
    });
  });

  it('uses the purchase payment and invoice number labels', () => {
    renderPage();
    expect(screen.getByText('Data de pagamento')).toBeInTheDocument();
    expect(screen.getByText('Número da nota fiscal')).toBeInTheDocument();
    expect(screen.queryByText('Vencimento')).not.toBeInTheDocument();
    expect(screen.queryByText('Documento')).not.toBeInTheDocument();
  });

  it('allows removing added items but keeps at least one item', async () => {
    const user = userEvent.setup(); renderPage();
    expect(screen.getByRole('button', { name: 'Remover item' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '+ Adicionar item' }));
    expect(screen.getAllByRole('button', { name: 'Remover item' }).every((button) => !button.hasAttribute('disabled'))).toBe(true);
    await user.click(screen.getAllByRole('button', { name: 'Remover item' })[0]);
    expect(screen.getAllByRole('button', { name: 'Remover item' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remover item' })).toBeDisabled();
  });
});

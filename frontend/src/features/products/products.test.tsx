import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpClient } from '@/shared/api/http';
import { ProductsListPage, NewProductPage, EditProductPage, ProductDetailPage } from './pages/product-pages';

const product = { id: 'product-1', organizationId: 'org-1', name: 'Filtro de óleo', description: 'Motor 1.6', sku: 'FIL-001', salePrice: '149.90', stockQuantity: 4, stockMinimum: 2, lowStock: false, active: true, createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-02T12:00:00.000Z' };

function renderPage(ui: React.ReactNode, initialEntries = ['/app/products']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={initialEntries}><Routes><Route path="/app/products" element={ui} /><Route path="/app/products/new" element={ui} /><Route path="/app/products/:id" element={ui} /><Route path="/app/products/:id/edit" element={ui} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('Product catalog', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists products and sends pagination, search, active filter and sort parameters', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [product], meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 } } } as never);
    renderPage(<ProductsListPage />, ['/app/products?page=2&pageSize=10&search=filtro&active=all&sort=name&direction=desc']);
    expect(await screen.findByText('Filtro de óleo')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/products', { params: { page: 2, pageSize: 10, search: 'filtro', active: undefined, sort: 'name', direction: 'desc' } });
    expect(screen.getByText('R$ 149,90')).toBeInTheDocument();
  });

  it('creates a product with a decimal price and never sends organizationId', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: product } as never);
    renderPage(<NewProductPage />);
    await user.type(await screen.findByLabelText('Nome'), 'Pastilha de freio');
    await user.type(screen.getByLabelText('Preço de venda'), '89,90');
    await user.click(screen.getByRole('button', { name: 'Salvar produto' }));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledWith('/products', { name: 'Pastilha de freio', salePrice: '89.90', stockQuantity: 0, stockMinimum: 0 }));
    expect(httpClient.post).not.toHaveBeenCalledWith('/products', expect.objectContaining({ organizationId: expect.anything() }));
  });

  it('edits only changed fields and handles SKU conflict', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: product } as never);
    const patch = vi.spyOn(httpClient, 'patch').mockRejectedValue(new ApiError({ status: 409, detail: 'duplicate', code: 'CONFLICT' }));
    renderPage(<EditProductPage />, ['/app/products/product-1/edit']);
    const name = await screen.findByLabelText('Nome');
    await user.clear(name); await user.type(name, 'Filtro novo');
    await user.click(screen.getByRole('button', { name: 'Salvar produto' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/products/product-1', { name: 'Filtro novo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um produto com este SKU.');
  });

  it('activates and deactivates a product through explicit actions', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { ...product, active: false } } as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...product, active: true } } as never);
    renderPage(<ProductDetailPage />, ['/app/products/product-1']);
    expect(await screen.findByRole('heading', { name: 'Filtro de óleo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ativar produto' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/products/product-1/activate'));
  });

  it('requires an exact decimal price before creating a product', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post');
    renderPage(<NewProductPage />);
    await user.type(await screen.findByLabelText('Nome'), 'Produto sem preço válido');
    await user.type(screen.getByLabelText('Preço de venda'), '12.345');
    await user.click(screen.getByRole('button', { name: 'Salvar produto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe um preço decimal válido.');
    expect(post).not.toHaveBeenCalled();
  });
});

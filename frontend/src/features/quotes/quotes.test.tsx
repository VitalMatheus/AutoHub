import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { listQuotes } from './api/quotes-api';
import { QuoteDetailPage, QuotesListPage } from './pages/quote-pages';

const customer = { id: 'customer-1', name: 'Maria Silva', active: true };
const vehicle = { id: 'vehicle-1', customerId: 'customer-1', plate: 'ABC1D23', brand: 'Toyota', model: 'Corolla', active: true };
const quote = { id: 'quote-1', number: 42, customerId: customer.id, vehicleId: vehicle.id, organization: { name: 'Oficina Central', document: '12.345.678/0001-90', phone: '(81) 99999-9999', email: 'oficina@example.com', city: 'Recife', state: 'PE' }, customer: { id: customer.id, name: customer.name, document: '123.456.789-09', phone: '(85) 99999-0000', email: 'maria@example.com' }, vehicle: { id: vehicle.id, plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, year: 2022 }, status: 'APPROVED', notes: null, items: [{ id: 'item-1', type: 'MANUAL', serviceId: null, productId: null, description: 'Troca de óleo', quantity: '1.000', unitPrice: '150.00', total: '150.00' }], total: '150.00', createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z' };

function renderPage(initialEntries = ['/app/quotes']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={initialEntries}><Routes><Route path="/app/quotes" element={<QuotesListPage />} /><Route path="/app/quotes/:id" element={<div />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('Quotes list', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('calls the Quotes API with search, status and pagination parameters', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [quote], meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 } } } as never);
    await listQuotes({ page: 2, pageSize: 20, search: 'ABC1D23', status: 'APPROVED' });
    expect(get).toHaveBeenCalledWith('/quotes', { params: { page: 2, pageSize: 20, search: 'ABC1D23', status: 'APPROVED' } });
  });

  it('renders customer, vehicle, item, translated status and total', async () => {
    vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/quotes') return Promise.resolve({ data: { data: [quote], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never;
      if (url === '/customers') return Promise.resolve({ data: { data: [customer] } }) as never;
      return Promise.resolve({ data: { data: [vehicle] } }) as never;
    });
    renderPage();
    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText(/Toyota Corolla.*ABC1D23/)).toBeInTheDocument();
    expect(screen.getAllByText('Aprovado').length).toBeGreaterThan(1);
    expect(screen.getByText('Troca de óleo (1)')).toBeInTheDocument();
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument();
  });

  it.each(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])(
    'requests and renders only %s Quotes when that status is selected',
    async (status) => {
      const user = userEvent.setup();
      const get = vi.spyOn(httpClient, 'get').mockImplementation((url, config) => {
        if (url === '/quotes') {
          const requestedStatus = (config?.params as { status?: string }).status;
          const data = !requestedStatus || requestedStatus === status ? [{ ...quote, status }] : [];
          return Promise.resolve({ data: { data, meta: { page: 1, pageSize: 20, total: data.length, totalPages: data.length } } }) as never;
        }
        if (url === '/customers') return Promise.resolve({ data: { data: [customer] } }) as never;
        return Promise.resolve({ data: { data: [vehicle] } }) as never;
      });

      renderPage();
      await screen.findByText('#42');
      await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por status' }), status);

      await waitFor(() => expect(get).toHaveBeenCalledWith('/quotes', {
        params: { page: 1, pageSize: 20, status },
      }));
      expect(await screen.findByText('#42')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Filtrar por status' })).toHaveValue(status);
    },
  );

  it('preserves search and status in the URL and resets to the first page', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], meta: { page: 3, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    renderPage(['/app/quotes?page=3&search=old&status=PENDING']);
    const search = await screen.findByRole('textbox', { name: 'Buscar por número, cliente ou placa' });
    await user.clear(search);
    await user.type(search, 'Maria');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por status' }), 'APPROVED');
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(screen.getByText('Nenhum orçamento encontrado.')).toBeInTheDocument();
  });

  it('paginates and shows the empty state', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, total: 21, totalPages: 2 } } } as never);
    renderPage();
    expect(await screen.findByText('Nenhum orçamento encontrado.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/quotes', { params: { page: 2, pageSize: 20 } }));
  });

  it('shows a Portuguese loading failure', async () => {
    vi.spyOn(httpClient, 'get').mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os orçamentos.');
  });

  it('keeps an approved quote visible after submit and approve', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:quote-export');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    let current = { ...quote, status: 'DRAFT' };
    vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/quotes') return Promise.resolve({ data: { data: [current], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never;
      if (url === '/quotes/quote-1') return Promise.resolve({ data: current }) as never;
      if (url === '/customers') return Promise.resolve({ data: { data: [customer] } }) as never;
      if (url === '/vehicles') return Promise.resolve({ data: { data: [vehicle] } }) as never;
      return Promise.resolve({ data: { data: [] } }) as never;
    });
    vi.spyOn(httpClient, 'post').mockImplementation((url) => {
      current = { ...current, status: url.endsWith('/submit') ? 'PENDING' : 'APPROVED' };
      return Promise.resolve({ data: current }) as never;
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/quotes/quote-1']}><Routes><Route path="/app/quotes" element={<QuotesListPage />} /><Route path="/app/quotes/:id" element={<QuoteDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);

    await user.click(await screen.findByRole('button', { name: 'Exportar orçamento' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download="orcamento-42.html"]')).not.toBeInTheDocument();
    expect(screen.getByText('Oficina Central')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 150,00').length).toBeGreaterThan(1);
    await user.click(await screen.findByRole('button', { name: 'Enviar para aprovação' }));
    await user.click(await screen.findByRole('button', { name: 'Aprovar' }));
    expect(await screen.findByText('Orçamento atualizado para Aprovado.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Voltar para Orçamentos/ }));
    expect((await screen.findAllByText('Aprovado')).length).toBeGreaterThan(1);
    expect(screen.queryByText('APPROVED')).not.toBeInTheDocument();
  });
});

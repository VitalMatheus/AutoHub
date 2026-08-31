import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { WorkOrdersListPage } from './pages/work-order-pages';

const customer = { id: 'customer-1', name: 'Maria Silva', active: true };
const vehicle = { id: 'vehicle-1', customerId: customer.id, plate: 'ABC1D23', brand: 'Toyota', model: 'Corolla' };
const workOrder = {
  id: 'wo-1', number: 42, customerId: customer.id, vehicleId: vehicle.id, quoteId: null,
  status: 'IN_PROGRESS', reportedProblem: null, diagnosis: null, mileage: null,
  expectedCompletionDate: null, notes: null, items: [], total: '250.00',
  createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><WorkOrdersListPage /></MemoryRouter></QueryClientProvider>);
}

describe('work orders operational list', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockImplementation((url, config) => {
      if (url === '/work-orders') return Promise.resolve({ data: { data: [workOrder], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      if (url === '/customers') return Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      if (url === '/vehicles') return Promise.resolve({ data: { data: [vehicle], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      return Promise.reject(new Error(`Unexpected ${url}`));
    });
  });

  it('renders number, customer, vehicle with plate, translated status and total', async () => {
    renderPage();
    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
    expect(screen.getByText('ABC1D23')).toBeInTheDocument();
    expect(screen.getAllByText('Em execução')).toHaveLength(2);
    expect(screen.getByText('R$ 250,00')).toBeInTheDocument();
  });

  it('searches by number, customer, plate, brand and model', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#42');
    const search = screen.getByPlaceholderText('Buscar por número, cliente, placa, marca ou modelo');
    await user.type(search, 'corolla');
    expect(screen.getByText('#42')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'cliente inexistente');
    expect(screen.getByText('Nenhuma ordem encontrada.')).toBeInTheDocument();
  });

  it('filters by status and sends the selected status to the API', async () => {
    const user = userEvent.setup();
    const get = vi.mocked(httpClient.get);
    renderPage();
    await screen.findByText('#42');
    await user.selectOptions(screen.getByLabelText('Filtrar por status'), 'COMPLETED');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/work-orders', { params: { page: 1, pageSize: 20, status: 'COMPLETED' } }));
  });

  it('shows every supported status translated in the filter', async () => {
    renderPage();
    await screen.findByText('#42');
    const filter = screen.getByLabelText('Filtrar por status');
    expect(filter).toHaveTextContent('Aberta');
    expect(filter).toHaveTextContent('Aguardando aprovação');
    expect(filter).toHaveTextContent('Em execução');
    expect(filter).toHaveTextContent('Aguardando peças');
    expect(filter).toHaveTextContent('Concluída');
    expect(filter).toHaveTextContent('Entregue');
    expect(filter).toHaveTextContent('Cancelada');
  });

  it('paginates the filtered list locally', async () => {
    const user = userEvent.setup();
    const orders = Array.from({ length: 21 }, (_, index) => ({ ...workOrder, id: `wo-${index}`, number: 42 + index }));
    vi.mocked(httpClient.get).mockImplementation((url, config) => {
      if (url === '/work-orders') return Promise.resolve({ data: { data: orders, meta: { page: 1, pageSize: 100, total: orders.length, totalPages: 1 } } }) as never;
      if (url === '/customers') return Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      if (url === '/vehicles') return Promise.resolve({ data: { data: [vehicle], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      return Promise.reject(new Error(`Unexpected ${url}`));
    });

    renderPage();
    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getByText('#62')).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('shows the empty state when no order matches', async () => {
    vi.mocked(httpClient.get).mockImplementation((url) => {
      if (url === '/work-orders') return Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } }) as never;
      if (url === '/customers') return Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      if (url === '/vehicles') return Promise.resolve({ data: { data: [vehicle], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      return Promise.reject(new Error(`Unexpected ${url}`));
    });

    renderPage();
    expect(await screen.findByText('Nenhuma ordem encontrada.')).toBeInTheDocument();
  });
});

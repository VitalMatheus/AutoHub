import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers/app-providers';
import { ApiError, httpClient, setAccessToken } from '@/shared/api/http';

const principal = { id: 'user-1', name: 'Ana Admin', email: 'ana@example.com', role: 'ADMIN' as const, organizationId: 'org-1' };
const customer = { id: 'customer-1', organizationId: 'org-1', name: 'Maria Silva', document: null, phone: '85999990000', email: 'maria@example.com', notes: null, active: true, createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-02T12:00:00.000Z' };
const vehicle = { id: 'vehicle-1', organizationId: 'org-1', customerId: 'customer-1', plate: 'ABC1D23', brand: 'Toyota', model: 'Corolla', year: 2022, color: 'Prata', mileage: 42000, notes: 'Revisão anual.', active: true, createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-02T12:00:00.000Z' };

function renderVehicles(path = '/app/vehicles', historyResponse: unknown = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }) {
  window.history.pushState({}, '', path);
  vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never);
  vi.spyOn(httpClient, 'get').mockImplementation((url) => {
    if (url === '/auth/me') return Promise.resolve({ data: principal }) as never;
    if (url === '/customers') return Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
    if (url === '/vehicles/vehicle-1/work-orders') return Promise.resolve({ data: historyResponse }) as never;
    if (url.startsWith('/vehicles/')) return Promise.resolve({ data: vehicle }) as never;
    return Promise.resolve({ data: { data: [vehicle], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never;
  });
  render(<AppProviders />);
}

describe('Vehicle management through the routed application', () => {
  beforeEach(() => { vi.restoreAllMocks(); setAccessToken(null); window.history.pushState({}, '', '/'); });

  it('lists vehicles and resolves the linked customer name', async () => {
    renderVehicles();
    expect(await screen.findByText('ABC1D23')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
  });

  it('creates a vehicle with normalized-compatible form fields and navigates to details', async () => {
    const user = userEvent.setup();
    renderVehicles('/app/vehicles/new');
    await screen.findByRole('heading', { name: 'Novo veículo' });
    await user.selectOptions(screen.getByLabelText('Cliente'), 'customer-1');
    await user.type(screen.getByLabelText('Placa'), 'abc-1d23');
    await user.type(screen.getByLabelText('Marca'), ' Toyota ');
    await user.type(screen.getByLabelText('Modelo'), ' Corolla ');
    await user.clear(screen.getByLabelText('Ano')); await user.type(screen.getByLabelText('Ano'), '2022');
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: vehicle } as never);
    await user.click(screen.getByRole('button', { name: 'Salvar veículo' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/vehicles', expect.objectContaining({ customerId: 'customer-1', plate: 'abc-1d23', brand: 'Toyota', model: 'Corolla', year: 2022 })));
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeInTheDocument();
  });

  it('shows safe conflict feedback when a plate already exists', async () => {
    const user = userEvent.setup();
    renderVehicles('/app/vehicles/new');
    await screen.findByRole('heading', { name: 'Novo veículo' });
    await user.selectOptions(screen.getByLabelText('Cliente'), 'customer-1');
    await user.type(screen.getByLabelText('Placa'), 'ABC1D23');
    await user.type(screen.getByLabelText('Marca'), 'Toyota');
    await user.type(screen.getByLabelText('Modelo'), 'Corolla');
    vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 409, detail: 'duplicate', code: 'CONFLICT' }));
    await user.click(screen.getByRole('button', { name: 'Salvar veículo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um veículo com esta placa.');
  });

  it('loads vehicle details and exposes its linked customer and edit action', async () => {
    renderVehicles('/app/vehicles/vehicle-1');
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar veículo' })).toHaveAttribute('href', '/app/vehicles/vehicle-1/edit');
  });

  it('does not send an update when editing without changes', async () => {
    const user = userEvent.setup(); renderVehicles('/app/vehicles/vehicle-1/edit'); await screen.findByRole('heading', { name: 'Editar veículo' });
    const patch = vi.spyOn(httpClient, 'patch'); await user.click(screen.getByRole('button', { name: 'Salvar veículo' }));
    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma alteração necessária.'); expect(patch).not.toHaveBeenCalled();
  });

  it('loads the vehicle service history with translated fields and a work order link', async () => {
    const historyResponse = { data: [{ id: 'wo-1', number: 42, vehicleId: vehicle.id, customerId: customer.id, quoteId: null, status: 'DELIVERED', mileage: 43000, diagnosis: null, reportedProblem: null, items: [{ id: 'item-1', description: 'Troca de óleo', quantity: '1.000', unitPrice: '150.00', total: '150.00', type: 'MANUAL' }], total: '150.00', createdAt: '2026-02-01T12:00:00.000Z', updatedAt: '2026-02-01T12:00:00.000Z', expectedCompletionDate: null, notes: null }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };
    renderVehicles('/app/vehicles/vehicle-1', historyResponse);
    expect(await screen.findByText('Troca de óleo')).toBeInTheDocument();
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument();
    expect(screen.getByText('Entregue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '#42' })).toHaveAttribute('href', '/app/work-orders/wo-1');
    await waitFor(() => expect(httpClient.get).toHaveBeenCalledWith('/vehicles/vehicle-1/work-orders', { params: { page: 1, pageSize: 20 } }));
  });

  it('shows a natural empty state for vehicles without completed services', async () => {
    renderVehicles('/app/vehicles/vehicle-1');
    expect(await screen.findByText('Nenhum serviço concluído para este veículo.')).toBeInTheDocument();
  });
});

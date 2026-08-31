import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers/app-providers';
import { ApiError, httpClient, setAccessToken } from '@/shared/api/http';

const principal = { id: 'user-1', name: 'Ana Admin', email: 'ana@example.com', role: 'ADMIN' as const, organizationId: 'org-1' };
const customer = { id: 'customer-1', organizationId: 'org-1', name: 'Maria Silva', document: '12345678900', phone: '85999990000', email: 'maria@example.com', notes: 'Prefere contato pela manhã.', active: true, createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-02T12:00:00.000Z' };

function renderCustomers(path = '/app/customers') {
  window.history.pushState({}, '', path);
  vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never);
  vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/auth/me' ? Promise.resolve({ data: principal }) as never : url.startsWith('/customers/') ? Promise.resolve({ data: customer }) as never : Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never);
  render(<AppProviders />);
}

describe('Customer management through the routed application', () => {
  beforeEach(() => { vi.restoreAllMocks(); setAccessToken(null); window.history.pushState({}, '', '/'); });

  it('lists Customers with the active filter and supported API query state', async () => {
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/auth/me' ? Promise.resolve({ data: principal }) as never : Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never);
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    window.history.pushState({}, '', '/app/customers?active=true&page=1&sort=name&direction=asc'); render(<AppProviders />);
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/customers', { params: expect.objectContaining({ active: true, page: 1, sort: 'name', direction: 'asc' }) }));
  });

  it('debounces search and keeps the query in the URL', async () => {
    const user = userEvent.setup(); const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/auth/me' ? Promise.resolve({ data: principal }) as never : Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } }) as never);
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never); window.history.pushState({}, '', '/app/customers'); render(<AppProviders />);
    const input = await screen.findByPlaceholderText('Buscar por nome, documento ou telefone'); await user.type(input, 'Maria');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/customers', { params: expect.objectContaining({ search: 'Maria', page: 1 }) }), { timeout: 1000 });
    expect(window.location.search).toContain('search=Maria');
  });

  it('applies Brazilian masks and sends normalized Customer fields', async () => {
    const user = userEvent.setup(); renderCustomers('/app/customers/new');
    await screen.findByRole('heading', { name: 'Novo cliente' }); await user.type(screen.getByLabelText(/Nome/), 'João Souza');
    const phone = screen.getByLabelText(/Telefone/); const document = screen.getByLabelText('CPF/CNPJ');
    await user.type(phone, '85988887777'); await user.type(document, '12345678901'); await user.type(screen.getByLabelText('E-mail'), 'joao@example.com');
    expect(phone).toHaveValue('(85) 98888-7777'); expect(document).toHaveValue('123.456.789-01');
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...customer, id: 'customer-2', name: 'João Souza' } } as never); await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/customers', { name: 'João Souza', document: '12345678901', phone: '85988887777', email: 'joao@example.com' }));
  });

  it('applies the CNPJ mask and validates Brazilian document and phone lengths', async () => {
    const user = userEvent.setup(); renderCustomers('/app/customers/new'); await screen.findByRole('heading', { name: 'Novo cliente' });
    await user.type(screen.getByLabelText(/Nome/), 'Empresa'); const phone = screen.getByLabelText(/Telefone/); const document = screen.getByLabelText('CPF/CNPJ');
    await user.type(phone, '8599'); await user.type(document, '11222333000181');
    expect(document).toHaveValue('11.222.333/0001-81'); await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(screen.getByText('Informe um telefone brasileiro com DDD.')).toBeInTheDocument(); expect(screen.queryByText('Informe um CPF ou CNPJ válido.')).not.toBeInTheDocument();
  });

  it('shows API conflict feedback without exposing unsupported fields', async () => {
    const user = userEvent.setup(); renderCustomers('/app/customers/new'); await screen.findByRole('heading', { name: 'Novo cliente' });
    await user.type(screen.getByLabelText(/Nome/), 'Duplicado'); await user.type(screen.getByLabelText(/Telefone/), '85999990000'); vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 409, detail: 'duplicate', code: 'CONFLICT' })); await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um cliente com este documento.'); expect(screen.queryByLabelText('Endereço')).not.toBeInTheDocument();
  });

  it('maps safe API field errors and validates DTO length limits', async () => {
    const user = userEvent.setup(); renderCustomers('/app/customers/new'); await screen.findByRole('heading', { name: 'Novo cliente' });
    await user.type(screen.getByLabelText(/Nome/), 'A'.repeat(161));
    await user.type(screen.getByLabelText(/Telefone/), '85999990000');
    await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(screen.getByText('Use no máximo 160 caracteres.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Nome/)); await user.type(screen.getByLabelText(/Nome/), 'Válido');
    vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError(Object.assign({ status: 400, detail: 'Request validation failed.', code: 'HTTP_400' }, { errors: { phone: 'Telefone inválido.' } })));
    await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(await screen.findByText('Telefone inválido.')).toBeInTheDocument();
  });

  it('sends empty optional fields when editing to clear them', async () => {
    const user = userEvent.setup(); renderCustomers('/app/customers/customer-1/edit'); await screen.findByRole('heading', { name: 'Editar Customer' });
    const patch = vi.spyOn(httpClient, 'patch').mockResolvedValue({ data: customer } as never);
    await user.clear(screen.getByLabelText('E-mail')); await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/customers/customer-1', { email: '' }));
  });

  it('shows Customer details and links to its Vehicle list without fabricated records', async () => { renderCustomers('/app/customers/customer-1'); expect(await screen.findByRole('heading', { name: 'Maria Silva' })).toBeInTheDocument(); expect(screen.getByText('Prefere contato pela manhã.')).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Ver veículos' })).toHaveAttribute('href', '/app/vehicles?customerId=customer-1'); });
});

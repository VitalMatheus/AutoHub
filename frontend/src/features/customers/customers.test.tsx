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

  it('does not request before the debounce interval', async () => {
    const user = userEvent.setup(); const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/auth/me' ? Promise.resolve({ data: principal }) as never : Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never);
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never); window.history.pushState({}, '', '/app/customers'); render(<AppProviders />);
    const input = await screen.findByPlaceholderText('Buscar por nome, documento ou telefone');
    await user.type(input, 'M');
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    expect(get.mock.calls.filter(([url]) => url === '/customers')).toHaveLength(1);
    await waitFor(() => expect(get.mock.calls.filter(([url]) => url === '/customers')).toHaveLength(2), { timeout: 1000 });
  });

  it('keeps the current rows visible while a filtered request is pending', async () => {
    const user = userEvent.setup(); let resolveSearch!: (value: unknown) => void;
    const pendingSearch = new Promise((resolve) => { resolveSearch = resolve; });
    renderCustomers('/app/customers');
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => pendingSearch as never);
    await user.type(screen.getByPlaceholderText('Buscar por nome, documento ou telefone'), 'filtro');
    await waitFor(() => expect(get.mock.calls.filter(([calledUrl]) => calledUrl === '/customers')).toHaveLength(1), { timeout: 1000 });
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Atualizando…')).toBeInTheDocument();
    resolveSearch({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } });
    expect(await screen.findByText('Nenhum cliente encontrado.')).toBeInTheDocument();
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
    const user = userEvent.setup(); renderCustomers('/app/customers/customer-1/edit'); await screen.findByRole('heading', { name: 'Editar cliente' });
    const patch = vi.spyOn(httpClient, 'patch').mockResolvedValue({ data: customer } as never);
    await user.clear(screen.getByLabelText('E-mail')); await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/customers/customer-1', { email: '' }));
  });

  it('does not send an update when editing without changes', async () => {
    const user = userEvent.setup(); renderCustomers('/app/customers/customer-1/edit'); await screen.findByRole('heading', { name: 'Editar cliente' });
    const patch = vi.spyOn(httpClient, 'patch'); await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(await screen.findByRole('heading', { name: 'Maria Silva' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma alteração necessária.'); expect(patch).not.toHaveBeenCalled();
  });

  it('shows Customer details and links to its Vehicle list without fabricated records', async () => { renderCustomers('/app/customers/customer-1'); expect(await screen.findByRole('heading', { name: 'Maria Silva' })).toBeInTheDocument(); expect(screen.getByText('Prefere contato pela manhã.')).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Ver veículos' })).toHaveAttribute('href', '/app/vehicles?customerId=customer-1'); });

  it('shows a loading skeleton while the customer list is pending', async () => {
    let resolveList!: (value: unknown) => void;
    const list = new Promise((resolve) => { resolveList = resolve; });
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: principal }) as never;
      return list as never;
    });

    window.history.pushState({}, '', '/app/customers?search=loading');
    render(<AppProviders />);
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status').querySelectorAll('.animate-pulse')).toHaveLength(3);
    resolveList({ data: { data: [customer], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } });
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
  });

  it('shows the empty state and the first-customer action', async () => {
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/auth/me' ? Promise.resolve({ data: principal }) as never : Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } }) as never);
    window.history.pushState({}, '', '/app/customers');
    render(<AppProviders />);
    await waitFor(() => expect(screen.getByText('Nenhum cliente cadastrado.')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Cadastrar cliente' })).toHaveAttribute('href', '/app/customers/new');
  });

  it('shows a list error and retries through the HTTP boundary', async () => {
    let attempts = 0;
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: principal }) as never;
      attempts += 1;
      return attempts === 1 ? Promise.reject(new ApiError({ status: 503, detail: 'offline', code: 'UNAVAILABLE' })) as never : Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never;
    });
    window.history.pushState({}, '', '/app/customers?search=retry');
    render(<AppProviders />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os clientes.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('updates filter, sorting and pagination in the URL and API query', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/auth/me' ? Promise.resolve({ data: principal }) as never : Promise.resolve({ data: { data: [customer], meta: { page: 1, pageSize: 1, total: 2, totalPages: 2 } } }) as never);
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    window.history.pushState({}, '', '/app/customers?page=1&pageSize=1&active=true&sort=createdAt&direction=asc');
    render(<AppProviders />);
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Situação'), 'all');
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'name');
    await user.click(screen.getByRole('button', { name: 'Alternar direção' }));
    await waitFor(() => expect(window.location.search).toContain('active=all'));
    expect(window.location.search).toContain('sort=name');
    expect(window.location.search).toContain('direction=desc');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(window.location.search).toContain('page=2'));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/customers', { params: expect.objectContaining({ page: 2, pageSize: 1, active: undefined, sort: 'name', direction: 'desc' }) }));
  });

  it('navigates to the detail page with a confirmation after creating a customer', async () => {
    const user = userEvent.setup();
    renderCustomers('/app/customers/new');
    await screen.findByRole('heading', { name: 'Novo cliente' });
    await user.type(screen.getByLabelText(/Nome/), 'João Souza');
    await user.type(screen.getByLabelText(/Telefone/), '85988887777');
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...customer, id: 'customer-2', name: 'João Souza' } } as never);
    vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/auth/me' ? Promise.resolve({ data: principal }) as never : Promise.resolve({ data: { ...customer, id: 'customer-2', name: 'João Souza' } }) as never);
    await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(await screen.findByRole('heading', { name: 'João Souza' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cliente cadastrado com sucesso.');
    expect(post).toHaveBeenCalledWith('/customers', { name: 'João Souza', phone: '85988887777' });
  });

  it('rejects an invalid email before making a create request', async () => {
    const user = userEvent.setup();
    renderCustomers('/app/customers/new');
    await screen.findByRole('heading', { name: 'Novo cliente' });
    await user.type(screen.getByLabelText(/Nome/), 'Cliente');
    await user.type(screen.getByLabelText(/Telefone/), '85999990000');
    await user.type(screen.getByLabelText('E-mail'), 'email-invalido');
    const post = vi.spyOn(httpClient, 'post');
    await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalledWith('/customers', expect.anything());
  });

  it('validates required customer fields before creating', async () => {
    const user = userEvent.setup(); renderCustomers('/app/customers/new'); await screen.findByRole('heading', { name: 'Novo cliente' });
    const post = vi.spyOn(httpClient, 'post'); await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(screen.getByText('Informe o nome.')).toBeInTheDocument();
    expect(screen.getByText('Informe o telefone.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalledWith('/customers', expect.anything());
  });

  it('shows a safe fallback for a generic Problem Details failure', async () => {
    const user = userEvent.setup(); renderCustomers('/app/customers/new'); await screen.findByRole('heading', { name: 'Novo cliente' });
    await user.type(screen.getByLabelText(/Nome/), 'Cliente'); await user.type(screen.getByLabelText(/Telefone/), '85999990000');
    vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 503, detail: 'database exploded', code: 'SERVICE_UNAVAILABLE' })); await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar o cliente.');
    expect(screen.queryByText('database exploded')).not.toBeInTheDocument();
  });

  it('cancels new and edit actions without sending mutations', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post'); const patch = vi.spyOn(httpClient, 'patch');
    renderCustomers('/app/customers/new');
    await screen.findByRole('heading', { name: 'Novo cliente' });
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Clientes', level: 2 })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Visualizar' }));
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Maria Silva' })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalledWith('/customers', expect.anything());
    expect(patch).not.toHaveBeenCalled();
  });

  it('refreshes the detail after saving an edit and displays the confirmation', async () => {
    const user = userEvent.setup();
    const updated = { ...customer, name: 'Maria Atualizada' };
    let detailReads = 0;
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: principal }) as never;
      detailReads += 1;
      return Promise.resolve({ data: detailReads === 1 ? customer : updated }) as never;
    });
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    const patch = vi.spyOn(httpClient, 'patch').mockResolvedValue({ data: updated } as never);
    window.history.pushState({}, '', '/app/customers/customer-1/edit');
    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Editar cliente' });
    await user.clear(screen.getByLabelText(/Nome/));
    await user.type(screen.getByLabelText(/Nome/), 'Maria Atualizada');
    await user.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(await screen.findByRole('heading', { name: 'Maria Atualizada' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cliente atualizado com sucesso.');
    expect(patch).toHaveBeenCalledWith('/customers/customer-1', { name: 'Maria Atualizada' });
    expect(get).toHaveBeenCalledWith('/customers/customer-1');
    expect(detailReads).toBeGreaterThanOrEqual(2);
  });

  it('warns before unloading a dirty form', async () => {
    const user = userEvent.setup();
    renderCustomers('/app/customers/new');
    await screen.findByRole('heading', { name: 'Novo cliente' });
    await user.type(screen.getByLabelText(/Nome/), 'Rascunho');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

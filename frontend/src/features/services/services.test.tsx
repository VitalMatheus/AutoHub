import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { createService, listServices, serviceAction } from './api/services-api';
import { EditServicePage, NewServicePage, ServiceDetailPage, ServicesListPage } from './pages/service-pages';

const service = { id: 'service-1', organizationId: 'org-1', name: 'Troca de óleo', description: 'Óleo e filtro', price: '149.90', active: true, createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-02T12:00:00.000Z' };

function renderPage(element: React.ReactNode, initialEntry = '/app/services') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}>{element}</MemoryRouter></QueryClientProvider>);
}

describe('service frontend API contract', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('uses the services resource and never sends organizationId', async () => {
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: service } as never);
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [service], meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 } } } as never);
    await createService({ name: 'Troca de óleo', description: 'Óleo e filtro', price: '149.90' });
    await listServices({ page: 2, pageSize: 10, search: 'óleo', active: false, sort: 'price', direction: 'desc' });
    await serviceAction('service-1', 'deactivate');
    expect(post).toHaveBeenNthCalledWith(1, '/services', { name: 'Troca de óleo', description: 'Óleo e filtro', price: '149.90' });
    expect(get).toHaveBeenCalledWith('/services', { params: expect.objectContaining({ page: 2, pageSize: 10, search: 'óleo', active: false, sort: 'price', direction: 'desc' }) });
    expect(post).toHaveBeenNthCalledWith(2, '/services/service-1/deactivate');
    expect(JSON.stringify({ post: post.mock.calls, get: get.mock.calls })).not.toContain('organizationId');
  });
});

describe('service management behavior', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists paginated Services with search, active filter and sorting in the URL', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [service], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } as never);
    renderPage(<ServicesListPage />, '/app/services?active=true&sort=name&direction=asc');
    expect(await screen.findByText('Troca de óleo')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/services', { params: expect.objectContaining({ page: 1, active: true, sort: 'name', direction: 'asc' }) }));
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Buscar por nome ou descrição'), 'freio');
    await waitFor(() => expect(get.mock.calls.some(([, config]) => (config as { params: Record<string, unknown> }).params.search === 'freio')).toBe(true), { timeout: 1000 });
  });

  it('navigates from a service row to its saved details and offers editing', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/services/service-1'
      ? Promise.resolve({ data: service }) as never
      : Promise.resolve({ data: { data: [service], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never);
    renderPage(<Routes>
      <Route path="/app/services" element={<ServicesListPage />} />
      <Route path="/app/services/:id" element={<ServiceDetailPage />} />
      <Route path="/app/services/:id/edit" element={<div>Editor de serviço</div>} />
    </Routes>);

    await user.click(await screen.findByRole('link', { name: 'Troca de óleo' }));
    expect(await screen.findByRole('heading', { name: 'Troca de óleo' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Editar' }));
    expect(await screen.findByText('Editor de serviço')).toBeInTheDocument();
  });

  it('creates a Service with an exact decimal string and supported fields only', async () => {
    const user = userEvent.setup();
    const saved = { ...service, id: 'service-2', name: 'Alinhamento', description: 'Alinhamento completo', price: '89.90' };
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: saved } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: saved } as never);
    renderPage(<Routes><Route path="/app/services/new" element={<NewServicePage />} /><Route path="/app/services/:id" element={<ServiceDetailPage />} /></Routes>, '/app/services/new');
    await user.type(await screen.findByLabelText(/Nome/), 'Alinhamento');
    await user.type(screen.getByLabelText(/Preço/), '89,90');
    await user.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledWith('/services', { name: 'Alinhamento', price: '89.90' }));
    expect(await screen.findByRole('heading', { name: 'Alinhamento' })).toBeInTheDocument();
    expect(screen.getByText('Alinhamento completo')).toBeInTheDocument();
    expect(screen.getByText('R$ 89,90')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(JSON.stringify(post.mock.calls)).not.toContain('organizationId');
  });

  it('edits a Service and activates or deactivates it with explicit actions', async () => {
    const user = userEvent.setup();
    let saved = service;
    const patch = vi.spyOn(httpClient, 'patch').mockImplementation(async () => {
      saved = { ...service, name: 'Troca completa', description: 'Serviço atualizado', price: '159.90' };
      return { data: saved } as never;
    });
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...service, active: false } } as never);
    vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/services/service-1' ? Promise.resolve({ data: saved }) as never : Promise.resolve({ data: { data: [service], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }) as never);
    renderPage(<Routes><Route path="/app/services/:id/edit" element={<EditServicePage />} /><Route path="/app/services/:id" element={<ServiceDetailPage />} /></Routes>, '/app/services/service-1/edit');
    const name = await screen.findByLabelText(/Nome/);
    await user.clear(name); await user.type(name, 'Troca completa');
    await user.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/services/service-1', { name: 'Troca completa' }));
    expect(await screen.findByRole('heading', { name: 'Troca completa' })).toBeInTheDocument();
    expect(screen.getByText('Serviço atualizado')).toBeInTheDocument();
    expect(screen.getByText('R$ 159,90')).toBeInTheDocument();
    cleanup();
    renderPage(<Routes><Route path="/app/services" element={<ServicesListPage />} /></Routes>);
    await screen.findByText('Troca de óleo');
    await user.click(screen.getByRole('button', { name: 'Desativar serviço' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/services/service-1/deactivate'));
  });

  it('shows saved Service details and maintains its active status', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...service, active: false } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: service } as never);
    renderPage(<Routes><Route path="/app/services/:id" element={<ServiceDetailPage />} /><Route path="/app/services/:id/edit" element={<div />} /></Routes>, '/app/services/service-1');

    expect(await screen.findByRole('heading', { name: 'Troca de óleo' })).toBeInTheDocument();
    expect(screen.getByText('Óleo e filtro')).toBeInTheDocument();
    expect(screen.getByText('R$ 149,90')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desativar serviço' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/services/service-1/deactivate'));
  });

  it('activates an inactive service and updates the details status', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { ...service, active: false } } as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...service, active: true } } as never);
    renderPage(<Routes><Route path="/app/services/:id" element={<ServiceDetailPage />} /></Routes>, '/app/services/service-1');

    await user.click(await screen.findByRole('button', { name: 'Ativar serviço' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/services/service-1/activate'));
    expect(await screen.findByRole('button', { name: 'Desativar serviço' })).toBeInTheDocument();
  });
});

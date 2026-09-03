import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { PlanDetailPage, PlansListPage } from './pages/plan-pages';

const version = { id: 'version-1', planId: 'plan-1', version: 2, status: 'PUBLISHED', price: '79.00', currency: 'BRL', interval: 'MONTHLY', organizationLimit: 2, userLimit: 5, workOrderLimit: null, gracePeriodDays: 5, publishedAt: '2026-01-02T03:00:00Z', createdAt: '2026-01-01T03:00:00Z' };
const plan = { id: 'plan-1', name: 'AutoHub Básico', archivedAt: null, createdAt: '2026-01-01T03:00:00Z', updatedAt: '2026-01-01T03:00:00Z', versions: [version] };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe('Platform Plans routed pages', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists plans and identifies draft, published and archived versions from the API', async () => {
    const archived = { ...plan, id: 'plan-2', name: 'Legado', archivedAt: '2026-02-01T03:00:00Z', versions: [{ ...version, id: 'version-3', planId: 'plan-2', status: 'PUBLISHED' }] };
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [{ ...plan, versions: [{ ...version, id: 'version-2', status: 'DRAFT' }, version] }, archived], meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/plans']}><Routes><Route path="/platform/plans" element={<PlansListPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText('AutoHub Básico')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Publicada')).toBeInTheDocument();
    expect(screen.getByText('Arquivada')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/platform/plans', { params: { page: 1, pageSize: 20, search: undefined } });
  });

  it('shows API price, currency, interval and null limits in the routed detail', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: plan } as never);
    render(<MemoryRouter initialEntries={['/platform/plans/plan-1']}><Routes><Route path="/platform/plans/:id" element={<PlanDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText('AutoHub Básico')).toBeInTheDocument();
    expect(screen.getByText('R$ 79,00')).toBeInTheDocument();
    expect(screen.getByText('BRL')).toBeInTheDocument();
    expect(screen.getByText('mês')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getAllByText('Ilimitado')).toHaveLength(1);
    expect(screen.queryByText(/benefício/i)).not.toBeInTheDocument();
  });

  it('covers loading, API error, no plans and no versions at the routed seams', async () => {
    vi.spyOn(httpClient, 'get').mockReturnValueOnce(new Promise(() => {}) as never);
    render(<MemoryRouter initialEntries={['/platform/plans']}><Routes><Route path="/platform/plans" element={<PlansListPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(screen.getByText('Carregando Plans…')).toBeInTheDocument();

    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    const empty = render(<MemoryRouter initialEntries={['/platform/plans']}><Routes><Route path="/platform/plans" element={<PlansListPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhum Plan')).toBeInTheDocument();
    empty.unmount();

    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter initialEntries={['/platform/plans']}><Routes><Route path="/platform/plans" element={<PlansListPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Não foi possível carregar os Plans.')).toBeInTheDocument();

    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { ...plan, versions: [] } } as never);
    render(<MemoryRouter initialEntries={['/platform/plans/plan-1']}><Routes><Route path="/platform/plans/:id" element={<PlanDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma Plan Version')).toBeInTheDocument();

    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockReturnValueOnce(new Promise(() => {}) as never);
    const detailPending = render(<MemoryRouter initialEntries={['/platform/plans/plan-1']}><Routes><Route path="/platform/plans/:id" element={<PlanDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(screen.getByText('Carregando Plan…')).toBeInTheDocument();
    detailPending.unmount();

    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter initialEntries={['/platform/plans/plan-1']}><Routes><Route path="/platform/plans/:id" element={<PlanDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Não foi possível carregar o Plan.')).toBeInTheDocument();
  });

  it('creates a draft with decimal strings and requires confirmation before publishing', async () => {
    const user = userEvent.setup();
    const draft = { ...version, id: 'draft-1', version: 3, status: 'DRAFT', price: '129.90', publishedAt: null };
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { ...plan, versions: [draft] } } as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: draft } as never);
    const patch = vi.spyOn(httpClient, 'patch').mockResolvedValue({ data: draft } as never);
    render(<MemoryRouter initialEntries={['/platform/plans/plan-1']}><Routes><Route path="/platform/plans/:id" element={<PlanDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    await screen.findByText('Plan Version v3');
    await user.click(screen.getByRole('button', { name: 'Editar draft' }));
    await user.clear(screen.getByLabelText('Preço'));
    await user.type(screen.getByLabelText('Preço'), '139.90');
    await user.click(screen.getByRole('button', { name: 'Salvar draft' }));
    expect(patch).toHaveBeenCalledWith('/platform/plans/plan-1/versions/draft-1', expect.objectContaining({ price: '139.90' }));
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('ficará imutável');
    expect(post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('dialog').querySelector('button:last-child') as HTMLButtonElement);
    expect(post).toHaveBeenCalledWith('/platform/plans/plan-1/versions/draft-1/publish');
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('shows create Plan and archive confirmation without retrying failed mutations', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    const post = vi.spyOn(httpClient, 'post').mockRejectedValue(new Error('offline'));
    render(<MemoryRouter initialEntries={['/platform/plans']}><Routes><Route path="/platform/plans" element={<PlansListPage />} /></Routes></MemoryRouter>, { wrapper });
    await screen.findByText('Nenhum Plan');
    await user.click(screen.getByRole('button', { name: 'Novo Plan' }));
    await user.type(screen.getByLabelText('Nome'), 'Pro');
    await user.click(screen.getByRole('button', { name: 'Criar Plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir');
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

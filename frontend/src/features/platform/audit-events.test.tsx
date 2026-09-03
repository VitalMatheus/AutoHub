import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { AuditEventsPage } from './pages/audit-event-pages';

const id = '00000000-0000-4000-8000-000000000001';
const event = { id, occurredAt: '2026-09-01T12:00:00.000Z', actor: { type: 'USER' as const, userId: id, name: 'Ana Lima', email: 'ana@example.com' }, action: 'organization.updated' as const, target: { type: 'ORGANIZATION' as const, id }, reason: 'Correção cadastral', changes: { before: { name: 'Oficina antiga' }, after: { name: 'Oficina Recife' } } };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
const renderPage = (entry = '/platform/audit-events') => render(<MemoryRouter initialEntries={[entry]}><AuditEventsPage /></MemoryRouter>, { wrapper });

describe('Audit Events', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders the reverse-chronological timeline, safe snapshots and URL filters', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [event], meta: { pageSize: 20, hasNextPage: false, nextCursor: null } } } as never);
    renderPage('/platform/audit-events?from=2026-09-01T00%3A00%3A00.000Z&actor=SYSTEM&targetType=ORGANIZATION&pageSize=20');
    expect(await screen.findByText('Oficina Recife')).toBeInTheDocument();
    expect(screen.getAllByText('Organization atualizada').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ana Lima/)).toBeInTheDocument();
    expect(screen.getByText('Correção cadastral')).toBeInTheDocument();
    expect(screen.getByText(/\"name\": \"Oficina antiga\"/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/platform/audit-events', { params: { pageSize: 20, from: '2026-09-01T00:00:00.000Z', actor: 'SYSTEM', targetType: 'ORGANIZATION' } });
  });

  it('loads the next cursor page without bulk lookups', async () => {
    const second = { ...event, id: '00000000-0000-4000-8000-000000000002', target: { ...event.target, id: '00000000-0000-4000-8000-000000000002' }, changes: { before: null, after: null }, occurredAt: '2026-08-31T12:00:00.000Z' };
    const get = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { data: [event], meta: { pageSize: 1, hasNextPage: true, nextCursor: 'cursor-2' } } } as never).mockResolvedValueOnce({ data: { data: [second], meta: { pageSize: 1, hasNextPage: false, nextCursor: null } } } as never);
    renderPage('/platform/audit-events?pageSize=1');
    expect(await screen.findByText('Oficina Recife')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar próxima página' }));
    expect(await screen.findByTitle(second.id)).toBeInTheDocument();
    expect(get).toHaveBeenNthCalledWith(2, '/platform/audit-events', { params: { pageSize: 1, cursor: 'cursor-2' } });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('covers loading, error and empty states', async () => {
    vi.spyOn(httpClient, 'get').mockReturnValueOnce(new Promise(() => {}) as never);
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando Audit Events');
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('offline'));
    const error = renderPage();
    expect(await screen.findByText('Não foi possível carregar os Audit Events.')).toBeInTheDocument();
    error.unmount();
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { data: [], meta: { pageSize: 20, hasNextPage: false, nextCursor: null } } } as never);
    renderPage();
    expect(await screen.findByText('Nenhum Audit Event')).toBeInTheDocument();
  });
});

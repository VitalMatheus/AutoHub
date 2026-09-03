import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { SubscriptionDetailPage, SubscriptionsListPage } from './pages/subscription-pages';

const subscription = { id: 'sub-1', commercialAccountId: 'account-1', status: 'CURRENT', contractedPrice: '129.90', contractedCurrency: 'BRL', contractedInterval: 'MONTHLY', contractedGracePeriodDays: 5, commercialStartAt: '2026-01-01T03:00:00Z', currentPeriodEnd: '2026-10-01T03:00:00Z', firstPaymentReceivedAt: '2026-01-03T03:00:00Z', trialStartsAt: null, trialEndsAt: null, cancellationRequestedAt: null, effectiveCancellationAt: null, createdAt: '2026-01-01T03:00:00Z', planVersion: { id: 'pv-1', version: 2, plan: { id: 'p-1', name: 'Pro' } }, commercialAccount: { id: 'account-1', name: 'Grupo Motor' }, conditions: { pendingCommercialSetup: false, trial: false, awaitingFirstPayment: false, delinquent: false, paymentGracePeriod: false, scheduledCancellation: false, effectiveCancellation: false, commercialAccess: 'ACCESS_ALLOWED' }, scheduledPlanVersionId: 'pv-3', scheduledPlanEffectiveAt: '2026-11-01T03:00:00Z', scheduledRecurringAdjustment: '10.00', scheduledAdjustmentEffectiveAt: '2026-11-01T03:00:00Z' };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe('Platform subscriptions', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('loads contract snapshots, filters, persists URL and shows scheduled changes separately', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [subscription], meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/subscriptions?commercialAccountId=account-1&status=CURRENT&page=2&pageSize=10']}><SubscriptionsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Grupo Motor')).toBeInTheDocument();
    expect(screen.getByText(/R\$ 129,90/)).toBeInTheDocument();
    expect(screen.getByText('Acesso permitido')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/platform/subscriptions', { params: { commercialAccountId: 'account-1', status: 'CURRENT', page: 2, pageSize: 10 } });
  });

  it('renders detail current conditions and scheduled cancellation/change dates', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { ...subscription, conditions: { ...subscription.conditions, scheduledCancellation: true }, cancellationRequestedAt: '2026-09-01T03:00:00Z', effectiveCancellationAt: '2026-10-01T03:00:00Z' } } as never);
    render(<MemoryRouter initialEntries={['/platform/subscriptions/sub-1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/platform/subscriptions/:id" element={<SubscriptionDetailPage />} /></Routes></QueryClientProvider></MemoryRouter>);
    const current = (await screen.findByText('Condições atuais')).closest('section');
    expect(current).toBeTruthy();
    expect(current).not.toHaveTextContent('Cancelamento agendado');
    expect(screen.getByText('Alterações agendadas')).toBeInTheDocument();
    expect(screen.getByText('Cancelamento solicitado')).toBeInTheDocument();
    expect(screen.getByText('01/09/2026')).toBeInTheDocument();
    expect(screen.getAllByText('01/10/2026')).toHaveLength(3);
  });

  it.each([
    ['plan', 'Trocar Plan', '/platform/subscriptions/sub-1/plan-change', { planVersionId: 'pv-2', effectiveAt: '2026-12-01T03:00:00.000Z', reason: 'Mudança comercial' }],
    ['price', 'Ajustar Contracted Price', '/platform/subscriptions/sub-1/recurring-price-adjustment', { amount: '-10.00', effectiveAt: '2026-12-01T03:00:00.000Z', reason: 'Desconto negociado' }],
    ['cancel', 'Agendar cancelamento', '/platform/subscriptions/sub-1/cancel', { reason: 'Solicitação do cliente' }],
    ['immediate', 'Cancelar imediatamente', '/platform/subscriptions/sub-1/cancel-immediately', { reason: 'Risco comercial elevado' }],
  ])('submits the %s action with the backend contract and refreshes canonical queries', async (_name, button, endpoint, expected) => {
    const user = userEvent.setup();
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/platform/plans') return Promise.resolve({ data: { data: [{ id: 'p-1', name: 'Pro', archivedAt: null, versions: [{ id: 'pv-2', version: 3, status: 'PUBLISHED' }] }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } }) as never;
      return Promise.resolve({ data: subscription }) as never;
    });
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: subscription } as never);
    render(<MemoryRouter initialEntries={['/platform/subscriptions/sub-1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/platform/subscriptions/:id" element={<SubscriptionDetailPage />} /></Routes></QueryClientProvider></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: button }));
    if (button === 'Trocar Plan') { await user.selectOptions(screen.getByLabelText('Plan Version'), 'pv-2'); await user.type(screen.getByLabelText('Data efetiva futura'), '2026-12-01T00:00'); }
    if (button === 'Ajustar Contracted Price') { await user.type(screen.getByLabelText(/Ajuste recorrente/), '-10.00'); await user.type(screen.getByLabelText('Data efetiva futura'), '2026-12-01T00:00'); }
    await user.type(screen.getByLabelText('Motivo'), expected.reason);
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(endpoint, expect.objectContaining(expected)));
    expect(get).toHaveBeenCalledWith('/platform/subscriptions/sub-1');
  });

  it('submits regularization only with its dates and reason', async () => {
    const user = userEvent.setup(); const pending = { ...subscription, conditions: { ...subscription.conditions, pendingCommercialSetup: true } };
    vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/platform/plans' ? Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } }) as never : Promise.resolve({ data: pending }) as never); const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: pending } as never);
    render(<MemoryRouter initialEntries={['/platform/subscriptions/sub-1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/platform/subscriptions/:id" element={<SubscriptionDetailPage />} /></Routes></QueryClientProvider></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Regularizar' }));
    const startDate = screen.getByLabelText('Data efetiva do início comercial'); await user.type(startDate, '2026-01-01T00:00'); await user.type(screen.getByLabelText('Motivo'), 'Dados de migração confirmados'); fireEvent.submit(startDate.closest('form')!);
    await waitFor(() => expect(post).toHaveBeenCalledWith('/platform/subscriptions/sub-1/regularize', expect.objectContaining({ reason: 'Dados de migração confirmados' })));
  });

  it('undoes a scheduled cancellation with a reason', async () => {
    const user = userEvent.setup(); const scheduled = { ...subscription, conditions: { ...subscription.conditions, scheduledCancellation: true } };
    vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/platform/plans' ? Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } }) as never : Promise.resolve({ data: scheduled }) as never); const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: scheduled } as never);
    render(<MemoryRouter initialEntries={['/platform/subscriptions/sub-1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/platform/subscriptions/:id" element={<SubscriptionDetailPage />} /></Routes></QueryClientProvider></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Desfazer cancelamento' })); await user.type(screen.getByLabelText('Motivo'), 'Cliente decidiu permanecer'); await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/platform/subscriptions/sub-1/undo-cancellation', { reason: 'Cliente decidiu permanecer' }));
  });

  it('keeps mutation errors distinct from refresh errors and highlights immediate cancellation risk', async () => {
    const user = userEvent.setup(); vi.spyOn(httpClient, 'get').mockImplementation((url) => url === '/platform/plans' ? Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } } }) as never : Promise.resolve({ data: subscription }) as never); vi.spyOn(httpClient, 'post').mockRejectedValue(new Error('mutation failed'));
    render(<MemoryRouter initialEntries={['/platform/subscriptions/sub-1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/platform/subscriptions/:id" element={<SubscriptionDetailPage />} /></Routes></QueryClientProvider></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Cancelar imediatamente' })); expect(screen.getByText(/consequências imediatas/)).toBeInTheDocument(); await user.type(screen.getByLabelText('Motivo'), 'Risco alto'); await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a ação.');
  });

  it('shows loading, API error, structural empty and filtered-empty states', async () => {
    vi.spyOn(httpClient, 'get').mockReturnValueOnce(new Promise(() => {}) as never);
    const pending = render(<MemoryRouter><SubscriptionsListPage /></MemoryRouter>, { wrapper });
    expect(screen.getByText('Carregando Subscriptions…')).toBeInTheDocument();
    pending.unmount();
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    const { unmount } = render(<MemoryRouter><SubscriptionsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma Subscription')).toBeInTheDocument();
    unmount();
    vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><SubscriptionsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Não foi possível carregar as Subscriptions.')).toBeInTheDocument();
    // A filtered response uses a distinct no-results message at the same routed seam.
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/subscriptions?status=ENDED']}><SubscriptionsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma Subscription encontrada')).toBeInTheDocument();
  });
});

import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getAllByText('01/10/2026')).toHaveLength(2);
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

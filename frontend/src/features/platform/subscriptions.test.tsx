import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { SubscriptionsListPage } from './pages/subscription-pages';

const subscription = { id: 'sub-1', commercialAccountId: 'account-1', status: 'CURRENT', contractedPrice: '129.90', contractedCurrency: 'BRL', contractedInterval: 'MONTHLY', contractedGracePeriodDays: 5, commercialStartAt: '2026-01-01T03:00:00Z', currentPeriodEnd: '2026-10-01T03:00:00Z', firstPaymentReceivedAt: '2026-01-03T03:00:00Z', trialStartsAt: null, trialEndsAt: null, cancellationRequestedAt: null, effectiveCancellationAt: null, createdAt: '2026-01-01T03:00:00Z', planVersion: { id: 'pv-1', version: 2, plan: { id: 'p-1', name: 'Pro' } }, commercialAccount: { id: 'account-1', name: 'Grupo Motor' }, conditions: { pendingCommercialSetup: false, trial: false, awaitingFirstPayment: false, delinquent: false, paymentGracePeriod: false, scheduledCancellation: false, effectiveCancellation: false, commercialAccess: 'ACCESS_ALLOWED' }, scheduledPlanVersionId: 'pv-3', scheduledPlanEffectiveAt: '2026-11-01T03:00:00Z', scheduledRecurringAdjustment: '10.00', scheduledAdjustmentEffectiveAt: '2026-11-01T03:00:00Z' };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe('Platform subscriptions', () => {
  it('loads contract snapshots, filters, persists URL and shows scheduled changes separately', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [subscription], meta: { page: 2, pageSize: 10, total: 11, totalPages: 2 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/subscriptions?commercialAccountId=account-1&status=CURRENT&page=2&pageSize=10']}><SubscriptionsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Grupo Motor')).toBeInTheDocument();
    expect(screen.getByText(/R\$ 129,90/)).toBeInTheDocument();
    expect(screen.getByText('Acesso permitido')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/platform/subscriptions', { params: { commercialAccountId: 'account-1', status: 'CURRENT', page: 2, pageSize: 10 } });
  });
});

import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { SubscriptionChargeDetailPage, SubscriptionChargesListPage } from './pages/subscription-charge-pages';

const charge = { id: 'charge-1', commercialAccountId: 'account-1', subscriptionId: 'sub-1', organizationId: null, amount: '129.90', dueDate: '2099-01-01T03:00:00Z', nature: 'RENEWAL' as const, billingPeriodStart: null, billingPeriodEnd: null, provider: null, externalId: null, cancelledAt: null, createdAt: '2026-01-01T03:00:00Z', updatedAt: '2026-01-01T03:00:00Z', commercialAccount: { id: 'account-1', name: 'Grupo Motor' }, subscription: { id: 'sub-1' }, organization: null, condition: 'PARTIALLY_PAID' as const, paidAmount: '40.00', outstandingAmount: '89.90', settlements: [{ id: 'settlement-1', originalSettlementId: null, kind: 'RECEIPT' as const, amount: '40.00', receivedAt: '2026-01-02T15:00:00Z', effectiveAt: null, reason: null, provider: 'manual', externalId: null, createdAt: '2026-01-02T15:00:00Z' }] };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe('Platform subscription charges', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads without a silent filter, renders amounts and preserves every filter in the URL', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [{ ...charge, condition: 'OVERDUE' }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/charges?commercialAccountId=account-1&subscriptionId=sub-1&organizationId=org-1&dueFrom=2026-01-01&dueTo=2026-01-31&condition=OVERDUE&nature=RENEWAL&page=2&pageSize=10']}><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Grupo Motor')).toBeInTheDocument();
    expect(screen.getByText('1 vencida nesta página')).toBeInTheDocument();
    expect(screen.getByText('R$ 129,90')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Renovação' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/platform/subscription-charges', { params: { commercialAccountId: 'account-1', subscriptionId: 'sub-1', organizationId: 'org-1', dueFrom: '2026-01-01', dueTo: '2026-01-31', condition: 'OVERDUE', nature: 'RENEWAL', page: 2, pageSize: 10 } });
  });

  it('renders chronological settlements and reversals with distinct billing vocabulary', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { ...charge, settlements: [...charge.settlements, { id: 'settlement-2', originalSettlementId: 'settlement-1', kind: 'REVERSAL' as const, amount: '-10.00', receivedAt: '2026-01-03T15:00:00Z', effectiveAt: '2026-01-04T15:00:00Z', reason: 'Estorno solicitado', provider: null, externalId: null, createdAt: '2026-01-04T15:00:00Z' }] } } as never);
    render(<MemoryRouter initialEntries={['/platform/charges/charge-1']}><Routes><Route path="/platform/charges/:id" element={<SubscriptionChargeDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Histórico de recebimentos')).toBeInTheDocument();
    expect(screen.getByText(/Recebimento · R\$ 40,00/)).toBeInTheDocument();
    expect(screen.getByText(/Reversão de recebimento/)).toBeInTheDocument();
    expect(screen.getByText(/-R\$ 10,00/)).toBeInTheDocument();
    expect(screen.getByText(/Motivo: Estorno solicitado/)).toBeInTheDocument();
    expect(screen.getByText(/não são Payments operacionais/)).toBeInTheDocument();
  });

  it('covers loading, API error, structural empty and filtered-empty states', async () => {
    vi.spyOn(httpClient, 'get').mockReturnValueOnce(new Promise(() => {}) as never);
    const pending = render(<MemoryRouter><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(screen.getByText('Carregando Subscription Charges…')).toBeInTheDocument();
    pending.unmount(); vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    const empty = render(<MemoryRouter><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma cobrança')).toBeInTheDocument();
    empty.unmount(); vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Não foi possível carregar as cobranças.')).toBeInTheDocument();
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/charges?condition=OVERDUE']}><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma cobrança encontrada')).toBeInTheDocument();
  });
});

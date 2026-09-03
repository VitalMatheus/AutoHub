import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { NewSubscriptionChargePage, SubscriptionChargeDetailPage, SubscriptionChargesListPage } from './pages/subscription-charge-pages';

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
    vi.spyOn(httpClient, 'get').mockReturnValue(new Promise(() => {}) as never);
    const pending = render(<MemoryRouter><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(screen.getByText('Carregando Subscription Charges…')).toBeInTheDocument();
    pending.unmount(); vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    const empty = render(<MemoryRouter><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma cobrança')).toBeInTheDocument();
    empty.unmount(); vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Não foi possível carregar as cobranças.')).toBeInTheDocument();
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/charges?condition=OVERDUE']}><SubscriptionChargesListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma cobrança encontrada')).toBeInTheDocument();
  });

  it('creates a manual charge with decimal payload and exposes pending state without retry', async () => {
    const user = userEvent.setup();
    let resolve: ((value: { data: typeof charge }) => void) | undefined;
    const post = vi.spyOn(httpClient, 'post').mockReturnValue(new Promise((done) => { resolve = done; }) as never);
    render(<MemoryRouter><NewSubscriptionChargePage /></MemoryRouter>, { wrapper });
    await user.type(screen.getByLabelText('Commercial Account ID'), 'account-1');
    await user.type(screen.getByLabelText('Subscription ID'), 'sub-1');
    await user.type(screen.getByLabelText('Organization ID'), 'org-1');
    await user.type(screen.getByLabelText('Valor da cobrança'), '129.90');
    await user.type(screen.getByLabelText('Vencimento da cobrança'), '2099-01-01');
    await user.click(screen.getByRole('button', { name: 'Criar cobrança' }));
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    expect(post).toHaveBeenCalledWith('/platform/subscription-charges', expect.objectContaining({ commercialAccountId: 'account-1', subscriptionId: 'sub-1', organizationId: 'org-1', amount: '129.90', dueDate: '2099-01-01', nature: 'ADJUSTMENT' }));
    resolve?.({ data: charge });
  });

  it('updates with a required reason, keeps settled amount immutable and shows mutation errors separately', async () => {
    const user = userEvent.setup();
    const mutable = { ...charge, condition: 'PENDING' as const, paidAmount: '0.00', outstandingAmount: '129.90', settlements: [] };
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: mutable } as never);
    const patch = vi.spyOn(httpClient, 'patch').mockRejectedValue(new Error('update failed'));
    render(<MemoryRouter initialEntries={['/platform/charges/charge-1']}><Routes><Route path="/platform/charges/:id" element={<SubscriptionChargeDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    await user.click(await screen.findByRole('button', { name: 'Editar cobrança' }));
    await user.clear(screen.getByLabelText('Novo valor')); await user.type(screen.getByLabelText('Novo valor'), '139.90');
    await user.type(screen.getByLabelText('Motivo da alteração'), 'Correção comercial');
    await user.click(screen.getByRole('button', { name: 'Salvar alteração' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/platform/subscription-charges/charge-1', { amount: '139.90', reason: 'Correção comercial' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a alteração.');
  });

  it('requires confirmation for eligible cancellation and never offers it for settled charges', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...charge, condition: 'CANCELLED', cancelledAt: '2026-02-01T03:00:00Z' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { ...charge, condition: 'PENDING', paidAmount: '0.00', outstandingAmount: '129.90', settlements: [] } } as never);
    render(<MemoryRouter initialEntries={['/platform/charges/charge-1']}><Routes><Route path="/platform/charges/:id" element={<SubscriptionChargeDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    await user.click(await screen.findByRole('button', { name: 'Cancelar cobrança' }));
    expect(screen.getByText(/não poderá ser liquidada/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/platform/subscription-charges/charge-1/cancel'));
  });

  it('registers a decimal receipt only within the open balance and confirms before mutating', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: charge } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: charge } as never);
    render(<MemoryRouter initialEntries={['/platform/charges/charge-1']}><Routes><Route path="/platform/charges/:id" element={<SubscriptionChargeDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    await user.click(await screen.findByRole('button', { name: 'Registrar recebimento' }));
    await user.type(screen.getByLabelText('Valor do recebimento'), '20.00');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Confirmar recebimento?')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/platform/subscription-charges/charge-1/settlements', expect.objectContaining({ amount: '20.00', receivedAt: expect.any(String) })));
  });

  it('requires a reason and confirmation before reversing a receipt, preserving the original history item', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: charge } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: charge } as never);
    render(<MemoryRouter initialEntries={['/platform/charges/charge-1']}><Routes><Route path="/platform/charges/:id" element={<SubscriptionChargeDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    await user.click(await screen.findByRole('button', { name: 'Estornar recebimento' }));
    expect(screen.getByRole('button', { name: 'Continuar para estorno' })).toBeDisabled();
    await user.type(screen.getByLabelText('Motivo do estorno'), 'Pagamento duplicado');
    await user.click(screen.getByRole('button', { name: 'Continuar para estorno' }));
    expect(screen.getByText('Confirmar estorno?')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar estorno' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/platform/subscription-charges/charge-1/settlements/settlement-1/reverse', expect.objectContaining({ reason: 'Pagamento duplicado', effectiveAt: expect.any(String) })));
    expect(screen.getByText(/Recebimento · R\$ 40,00/)).toBeInTheDocument();
  });
});

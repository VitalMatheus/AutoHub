import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { listAllSubscriptionCharges } from './api/commercial-accounts-api';
import { CommercialAccountDetailPage, CommercialAccountsListPage } from './pages/commercial-account-pages';

const account = { id: 'account-1', name: 'Grupo Motor', billingEmail: 'financeiro@motor.test', billingDocument: '12.345.678/0001-90', primaryContact: { id: 'user-1', name: 'Ana Lima', email: 'ana@motor.test', role: 'ADMIN', status: 'ACTIVE', organizationId: 'org-1' }, missingPrimaryContact: false, organizations: [{ id: 'org-1', name: 'Motor Recife', operationalStatus: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' }], subscriptions: [{ id: 'sub-1', status: 'CURRENT', createdAt: '2026-01-01T00:00:00Z', contractedPrice: '79.00', contractedCurrency: 'BRL', contractedInterval: 'MONTHLY', contractedOrganizationLimit: 1, contractedUserLimit: 3, contractedWorkOrderLimit: null, contractedGracePeriodDays: 5, planVersion: { id: 'version-1', version: 1, plan: { id: 'plan-1', name: 'AutoHub Básico' } } }], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe('Commercial accounts', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('lists accounts through the API with search and pagination state', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [account], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/commercial-accounts?search=Grupo&page=1']}><CommercialAccountsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Grupo Motor')).toBeInTheDocument();
    expect(screen.getByText('Ana Lima')).toBeInTheDocument();
    expect(screen.getByText('AutoHub Básico')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/platform/commercial-accounts', { params: { page: 1, pageSize: 20, search: 'Grupo' } });
  });
  it('shows read-only account detail and links to filtered commercial modules', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: account } as never).mockResolvedValueOnce({ data: { data: [{ condition: 'OVERDUE', paidAmount: '10.00', outstandingAmount: '69.00' }], meta: {} } } as never);
    render(<MemoryRouter initialEntries={['/platform/commercial-accounts/account-1']}><Routes><Route path="/platform/commercial-accounts/:id" element={<CommercialAccountDetailPage />} /></Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Detalhes da relação comercial.')).toBeInTheDocument();
    expect(screen.getByText('Ana Lima')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Subscription' })).toHaveAttribute('href', '/platform/subscriptions?commercialAccountId=account-1');
    expect(screen.getByRole('link', { name: 'Ver cobranças desta conta' })).toHaveAttribute('href', '/platform/charges?commercialAccountId=account-1');
    expect(await screen.findByText('R$ 10,00')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 69,00')).toHaveLength(2);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('exposes loading and error states', async () => {
    let resolve!: (value: unknown) => void;
    vi.spyOn(httpClient, 'get').mockReturnValue(new Promise((done) => { resolve = done; }) as never);
    render(<MemoryRouter><CommercialAccountsListPage /></MemoryRouter>, { wrapper });
    expect(screen.getByRole('status')).toHaveTextContent('Carregando contas comerciais');
    resolve({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } });
    await screen.findByText('Nenhuma conta comercial');
    vi.restoreAllMocks();
    vi.spyOn(httpClient, 'get').mockRejectedValue(new Error('offline') as never);
    render(<MemoryRouter><CommercialAccountsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar esta área.');
  });
  it('distinguishes an empty search result from an empty account set', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/commercial-accounts?search=Inexistente']}><CommercialAccountsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma conta encontrada')).toBeInTheDocument();
    expect(screen.getByText('Tente ajustar sua busca.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Inexistente')).toBeInTheDocument();
  });
  it('loads every charge page before calculating an account summary', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: { data: [{ id: 'charge-1' }], meta: { totalPages: 2 } } } as never).mockResolvedValueOnce({ data: { data: [{ id: 'charge-2' }], meta: { totalPages: 2 } } } as never);
    const charges = await listAllSubscriptionCharges('account-1');
    expect(charges).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith('/platform/subscription-charges', { params: { commercialAccountId: 'account-1', page: 2, pageSize: 100 } });
  });
});

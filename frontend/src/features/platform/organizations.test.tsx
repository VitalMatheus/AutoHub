import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { OrganizationsListPage } from './pages/organization-pages';

const organization = { id: 'org-1', name: 'Motor Recife', operationalStatus: 'ACTIVE', commercialAccount: { id: 'account-1', name: 'Grupo Motor' }, primaryContact: { name: 'Ana Lima', email: 'ana@motor.test' }, plan: { name: 'AutoHub Básico', contractedPrice: '79.00', contractedCurrency: 'BRL', contractedInterval: 'MONTHLY' }, nextBillingDate: '2026-02-15T00:00:00Z', payment: { condition: 'PAID', paidAmount: '79.00', outstandingAmount: '0.00' }, commercialAccess: 'ACCESS_ALLOWED', effectiveAccess: { allowed: true, operationalStatus: 'ACTIVE', commercialAccess: 'ACCESS_ALLOWED' }, lifecycle: ['PAID_CURRENT'] };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe('Platform Organizations', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('loads organizations through the shared API boundary with URL filters and renders distinct dimensions', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [organization], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/organizations?search=Motor&operationalStatus=ACTIVE&lifecycle=PAID_CURRENT&commercialAccess=ACCESS_ALLOWED&sort=name&page=1']}><OrganizationsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Motor Recife')).toBeInTheDocument();
    expect(screen.getByText('Ana Lima')).toBeInTheDocument();
    expect(screen.getByText('AutoHub Básico')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ativo' })).toBeInTheDocument();
    expect(screen.getAllByRole('cell', { name: 'Permitido' })).toHaveLength(2);
    expect(screen.getByText('Acesso efetivo')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/platform/organizations', { params: { page: 1, pageSize: 20, search: 'Motor', operationalStatus: 'ACTIVE', lifecycle: ['PAID_CURRENT'], commercialAccess: ['ACCESS_ALLOWED'], sort: 'name' } });
  });
  it('distinguishes structural empty, no-results, loading, and error states', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/organizations?search=Inexistente']}><OrganizationsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Nenhuma Organization encontrada')).toBeInTheDocument();
    expect(screen.getByText('Tente ajustar sua busca ou filtros.')).toBeInTheDocument();
  });
});

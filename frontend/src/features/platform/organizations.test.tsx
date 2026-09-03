import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpClient } from '@/shared/api/http';
import { OrganizationsListPage } from './pages/organization-pages';

const organization = { id: 'org-1', name: 'Motor Recife', operationalStatus: 'ACTIVE', financialStanding: { status: 'CURRENT', dueToday: true, dueDate: '2026-02-15' }, commercialAccount: { id: 'account-1', name: 'Grupo Motor' }, primaryContact: { name: 'Ana Lima', email: 'ana@motor.test' }, plan: { name: 'AutoHub Básico', contractedPrice: '79.00', contractedCurrency: 'BRL', contractedInterval: 'MONTHLY' }, nextBillingDate: '2026-02-15T00:00:00Z', payment: { condition: 'PAID', paidAmount: '79.00', outstandingAmount: '0.00' }, commercialAccess: 'ACCESS_ALLOWED', effectiveAccess: { allowed: true, operationalStatus: 'ACTIVE', commercialAccess: 'ACCESS_ALLOWED' }, lifecycle: ['PAID_CURRENT'], administrativePending: ['USER_LIMIT_EXCEEDED'] };
const pendingOrganization = { ...organization, id: 'org-pending', name: 'Oficina Legada', plan: null, nextBillingDate: null, payment: { condition: 'OPEN', paidAmount: '0.00', outstandingAmount: '0.00' }, lifecycle: ['PENDING_COMMERCIAL_SETUP'], administrativePending: [] };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe('Platform Organizations', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('loads organizations through the shared API boundary with URL filters and renders distinct dimensions', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [organization], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/organizations?search=Motor&operationalStatus=ACTIVE&lifecycle=PAID_CURRENT&commercialAccess=ACCESS_ALLOWED&sort=name&page=1']}><OrganizationsListPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText('Motor Recife')).toBeInTheDocument();
    expect(screen.getByText('Ana Lima')).toBeInTheDocument();
    expect(screen.getByText('AutoHub Básico')).toBeInTheDocument();
    expect(screen.getByText('Atual')).toBeInTheDocument();
    expect(screen.getByText(/USER_LIMIT_EXCEEDED/)).toBeInTheDocument();
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

  it('shows financial standing separately from operational status and applies its URL filter', async () => {
    const user = userEvent.setup();
    const organizations = [
      organization,
      { ...organization, id: 'org-2', name: 'Oficina Boa Viagem', operationalStatus: 'SUSPENDED', financialStanding: { status: 'DUE_SOON', dueToday: false, dueDate: '2026-02-20' } },
      { ...organization, id: 'org-3', name: 'Garage Olinda', financialStanding: { status: 'OVERDUE', dueToday: false, dueDate: '2026-02-10' } },
      { ...organization, id: 'org-4', name: 'Auto Norte', operationalStatus: 'ACTIVE', financialStanding: { status: 'PAYMENT_BLOCKED', dueToday: false, dueDate: '2026-02-09' } },
    ];
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: organizations, meta: { page: 1, pageSize: 20, total: 4, totalPages: 1 } } } as never);
    render(<MemoryRouter initialEntries={['/platform/organizations']}><OrganizationsListPage /></MemoryRouter>, { wrapper });

    const currentRow = (await screen.findByText('Motor Recife')).closest('tr')!;
    expect(within(currentRow).getByRole('cell', { name: 'Ativo' })).toBeInTheDocument();
    expect(within(currentRow).getByRole('cell', { name: /Em dia.*vence hoje/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Vence em breve' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Em atraso' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Bloqueada por pagamento' })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Situação financeira' }), 'OVERDUE');
    expect(get).toHaveBeenLastCalledWith('/platform/organizations', { params: expect.objectContaining({ page: 1, financialStanding: ['OVERDUE'] }) });
  });

  it('regularizes a pending Organization with the contracted price and billing dates', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [pendingOrganization], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { ...pendingOrganization, lifecycle: ['PAID_CURRENT'] } } as never);
    render(<MemoryRouter initialEntries={['/platform/organizations?lifecycle=PENDING_COMMERCIAL_SETUP']}><OrganizationsListPage /></MemoryRouter>, { wrapper });

    await user.click(await screen.findByRole('button', { name: 'Regularizar Oficina Legada' }));
    expect(screen.getAllByText('Configuração pendente').length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText('Preço contratado'), '89.90');
    await user.type(screen.getByLabelText('Primeiro vencimento'), '2026-10-10');
    await user.clear(screen.getByLabelText('Dia mensal de vencimento'));
    await user.type(screen.getByLabelText('Dia mensal de vencimento'), '10');
    await user.click(screen.getByRole('button', { name: 'Confirmar regularização' }));

    expect(post).toHaveBeenCalledWith('/platform/organizations/org-pending/regularize-commercial-setup', {
      contractedPrice: '89.90',
      firstDueDate: '2026-10-10',
      billingDay: 10,
    });
    expect(await screen.findByText('Configuração comercial de Oficina Legada regularizada.')).toBeInTheDocument();
  });

  it('keeps the pending setup visible when validation or the API rejects regularization', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [pendingOrganization], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } as never);
    const post = vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 409, code: 'COMMERCIAL_SETUP_ALREADY_REGULARIZED', detail: 'Commercial setup is already regularized.' }));
    render(<MemoryRouter initialEntries={['/platform/organizations']}><OrganizationsListPage /></MemoryRouter>, { wrapper });

    await user.click(await screen.findByRole('button', { name: 'Regularizar Oficina Legada' }));
    await user.type(screen.getByLabelText('Preço contratado'), '89.90');
    await user.type(screen.getByLabelText('Primeiro vencimento'), '2026-10-10');
    await user.clear(screen.getByLabelText('Dia mensal de vencimento'));
    await user.type(screen.getByLabelText('Dia mensal de vencimento'), '29');
    await user.click(screen.getByRole('button', { name: 'Confirmar regularização' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um dia entre 1 e 28.');
    expect(post).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Dia mensal de vencimento'));
    await user.type(screen.getByLabelText('Dia mensal de vencimento'), '10');
    await user.click(screen.getByRole('button', { name: 'Confirmar regularização' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível regularizar a configuração comercial.');
    expect(screen.getByText('Configuração pendente')).toBeInTheDocument();
  });
});

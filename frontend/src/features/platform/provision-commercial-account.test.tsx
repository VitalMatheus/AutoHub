import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpClient } from '@/shared/api/http';
import { ProvisionCommercialAccountPage } from './pages/provision-commercial-account-pages';

const plan = { id: 'plan-1', name: 'AutoHub Básico', archivedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', versions: [{ id: 'version-1', planId: 'plan-1', version: 1, status: 'PUBLISHED', price: '79.00', currency: 'BRL', interval: 'MONTHLY', organizationLimit: 1, userLimit: 3, workOrderLimit: null, gracePeriodDays: 5, publishedAt: '2026-01-01', createdAt: '2026-01-01' }] };
const created = { organization: { id: 'org-1', name: 'Oficina Recife', operationalStatus: 'ACTIVE' }, commercialAccount: { id: 'account-1', name: 'Grupo Motor', billingEmail: 'financeiro@motor.test', billingDocument: '12345678000190', primaryContactOrganizationId: 'org-1', primaryContactUserId: 'user-1' }, admin: { id: 'user-1', name: 'Ana Lima', email: 'ana@motor.test', role: 'ADMIN', status: 'PENDING_ACTIVATION' }, subscription: { id: 'sub-1', planVersionId: 'version-1', status: 'SCHEDULED', trialEnabled: true, trialStartsAt: null, trialEndsAt: null, contractedPrice: '79.00' }, activationToken: 'secret-only-once' };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
const renderPage = () => render(<MemoryRouter initialEntries={['/platform/commercial-accounts/new']}><Routes><Route path="/platform/commercial-accounts/new" element={<ProvisionCommercialAccountPage />} /><Route path="/platform/commercial-accounts" element={<p>Lista de contas</p>} /></Routes></MemoryRouter>, { wrapper });

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nome comercial'), 'Grupo Motor');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.type(screen.getByLabelText('Nome da Organization'), 'Oficina Recife');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.type(screen.getByLabelText('Nome do administrador'), 'Ana Lima');
  await user.type(screen.getByLabelText('E-mail do administrador'), 'ana@motor.test');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('Provisioning a Commercial Account', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('loads real published plan versions and completes the wizard with an in-memory activation secret', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [plan], meta: { totalPages: 1 } } } as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: created } as never);
    renderPage();
    await screen.findByRole('heading', { name: 'Provisionar Commercial Account' });
    expect(get).toHaveBeenCalledWith('/platform/plans', { params: { page: 1, pageSize: 100 } });
    await fillRequired(user);
    expect(await screen.findByRole('option', { name: /AutoHub Básico · v1/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Plan Version'), 'version-1');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Provisionar conta' }));
    expect(post).toHaveBeenCalledWith('/platform/organizations', expect.objectContaining({ name: 'Oficina Recife', admin: { name: 'Ana Lima', email: 'ana@motor.test' }, planVersionId: 'version-1', trialEnabled: true }));
    expect(await screen.findByText('Segredo de ativação')).toBeInTheDocument();
    expect(screen.getByDisplayValue('secret-only-once')).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain('secret-only-once');
  });

  it('shows validation beside the step, pending state, backend errors, copy, and warns before leaving without copying', async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [plan], meta: { totalPages: 1 } } } as never);
    const post = vi.spyOn(httpClient, 'post').mockReturnValue(new Promise((done) => { resolve = done; }) as never);
    renderPage();
    await screen.findByRole('heading', { name: 'Provisionar Commercial Account' });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Informe o nome comercial.')).toBeInTheDocument();
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText('Plan Version'), 'version-1');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Provisionar conta' }));
    expect(screen.getByRole('button', { name: 'Provisionando…' })).toBeDisabled();
    resolve({ data: created });
    await screen.findByText('Segredo de ativação');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(screen.getByDisplayValue('secret-only-once')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copiar segredo' }));
    expect(await screen.findByText('Segredo copiado.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('Lista de contas')).toBeInTheDocument();
    expect(screen.queryByText('secret-only-once')).not.toBeInTheDocument();
  });

  it('renders a safe backend error without losing entered context', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [plan], meta: { totalPages: 1 } } } as never);
    vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 409, detail: 'The Commercial Account allows at most 1 non-inactive Organizations.', code: 'PLAN_ORGANIZATION_LIMIT_REACHED' }));
    renderPage();
    await screen.findByRole('heading', { name: 'Provisionar Commercial Account' });
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText('Plan Version'), 'version-1');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Provisionar conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir o provisionamento.');
    expect(screen.getByText('Revise os dados da Subscription e tente novamente.')).toBeInTheDocument();
    expect(screen.getByText('Grupo Motor')).toBeInTheDocument();
  });
});

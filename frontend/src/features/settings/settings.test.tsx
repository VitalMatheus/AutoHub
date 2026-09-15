import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpClient } from '@/shared/api/http';
import { SettingsPage } from './pages/settings-pages';
import type { OrganizationUser } from './api/organization-users-api';

const admin: OrganizationUser = { id: 'user-1', name: 'Ana Admin', email: 'ana@example.com', status: 'ACTIVE', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
function renderPage() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter><SettingsPage /></MemoryRouter></QueryClientProvider>); }

describe('Organization User settings', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists users from the real organization users endpoint', async () => {
    const get = vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url === '/organizations/users' ? [admin] : { cancellation: null } }) as never);
    renderPage();
    expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/organizations/users');
    expect(screen.getByText('Administrador da oficina')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Encerrar assinatura' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings.at(-1)).toBe('Assinatura e cancelamento');
    expect(screen.queryByText('Subscription')).not.toBeInTheDocument();
    expect(screen.queryByText('Organization Admin')).not.toBeInTheDocument();
  });

  it('requests subscription cancellation from settings', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url === '/organizations/users' ? [] : { cancellation: null } }) as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { message: 'Confirmação enviada.' } } as never);
    renderPage();
    await user.type(await screen.findByLabelText('Senha atual para cancelar'), 'a-secure-password');
    await user.click(screen.getByRole('button', { name: 'Enviar confirmação' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/account/cancellation/request', { password: 'a-secure-password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirmação enviada.');
  });

  it('invites only with name and normalized email, never role or organizationId', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url === '/organizations/users' ? [] : { cancellation: null } }) as never);
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { user: { ...admin, email: 'novo@example.com' }, activationToken: 'one-time-token' } } as never);
    renderPage();
    await user.type(await screen.findByLabelText('Nome do usuário'), 'Novo Admin');
    await user.type(screen.getByLabelText('E-mail do usuário'), ' NOVO@EXAMPLE.COM ');
    await user.click(screen.getByRole('button', { name: 'Convidar administrador' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/organizations/users', { name: 'Novo Admin', email: 'novo@example.com' }));
    expect(post.mock.calls[0][1]).not.toHaveProperty('role');
    expect(post.mock.calls[0][1]).not.toHaveProperty('organizationId');
    expect(await screen.findByRole('alert')).toHaveTextContent('one-time-token');
  });

  it('shows the server reason when the workshop reached its administrator limit', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url === '/organizations/users' ? [] : { cancellation: null } }) as never);
    vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 409, detail: 'The Commercial Account allows at most 3 non-disabled Users.', code: 'PLAN_USER_LIMIT_REACHED' }));
    renderPage();
    await user.type(await screen.findByLabelText('Nome do usuário'), 'Novo Admin');
    await user.type(screen.getByLabelText('E-mail do usuário'), 'novo@example.com');
    await user.click(screen.getByRole('button', { name: 'Convidar administrador' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('O limite de administradores da sua assinatura foi atingido.');
  });

  it('keeps the invitation successful when refreshing the user list fails', async () => {
    const user = userEvent.setup();
    let usersRequest = 0;
    vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/organizations/users' && usersRequest++ > 0) return Promise.reject(new Error('refresh failed')) as never;
      return Promise.resolve({ data: url === '/organizations/users' ? [] : { cancellation: null } }) as never;
    });
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { user: { ...admin, email: 'novo@example.com' }, activationToken: 'one-time-token' } } as never);
    renderPage();
    await user.type(await screen.findByLabelText('Nome do usuário'), 'Novo Admin');
    await user.type(screen.getByLabelText('E-mail do usuário'), 'novo@example.com');
    await user.click(screen.getByRole('button', { name: 'Convidar administrador' }));

    expect(await screen.findByText((text) => text.includes('Convite criado para novo@example.com.'))).toBeInTheDocument();
  });

  it('activates, deactivates and revokes sessions through explicit endpoints', async () => {
    const user = userEvent.setup();
    let current = admin;
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.resolve({ data: url === '/organizations/users' ? [current] : { cancellation: null } }) as never);
    const post = vi.spyOn(httpClient, 'post').mockImplementation((url) => {
      current = { ...current, status: url.endsWith('/deactivate') ? 'DISABLED' : 'ACTIVE' };
      return Promise.resolve({ data: current }) as never;
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Ana Admin');
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/organizations/users/user-1/deactivate'));
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/organizations/users/user-1/activate'));
    await user.click(screen.getByRole('button', { name: 'Revogar sessões' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/organizations/users/user-1/revoke-sessions'));
  });

  it('shows generic feedback for API failures', async () => {
    vi.spyOn(httpClient, 'get').mockImplementation((url) => Promise.reject(new ApiError({ status: 500, detail: 'database secret', code: 'HTTP_500' })) as never);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os usuários.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('database secret');
  });
});

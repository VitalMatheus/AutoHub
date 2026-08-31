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
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: [admin] } as never);
    renderPage();
    expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/organizations/users');
    expect(screen.getByText('Organization Admin')).toBeInTheDocument();
  });

  it('invites only with name and normalized email, never role or organizationId', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: [] } as never);
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

  it('activates, deactivates and revokes sessions through explicit endpoints', async () => {
    const user = userEvent.setup();
    let current = admin;
    vi.spyOn(httpClient, 'get').mockImplementation(() => Promise.resolve({ data: [current] }) as never);
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
    vi.spyOn(httpClient, 'get').mockRejectedValue(new ApiError({ status: 500, detail: 'database secret', code: 'HTTP_500' }));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os usuários.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('database secret');
  });
});

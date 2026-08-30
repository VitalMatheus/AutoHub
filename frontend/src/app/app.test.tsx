import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from './providers/app-providers';
import { ApiError, getAccessToken, httpClient, setAccessToken } from '@/shared/api/http';

const principal = { id: 'user-1', name: 'Ana Admin', email: 'ana@example.com', role: 'ADMIN' as const, organizationId: 'org-1' };

describe('Organization Admin frontend shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores the browser session before rendering protected content', async () => {
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);

    expect(screen.queryByRole('heading', { name: 'Sua oficina está pronta' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sua oficina está pronta' })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/auth/refresh');
  });

  it('returns to login when session restoration fails', async () => {
    vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 401, detail: 'Sessão inválida.', code: 'HTTP_401' }));

    render(<AppProviders />);

    expect(await screen.findByRole('heading', { name: 'Entrar na oficina' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sua oficina está pronta' })).not.toBeInTheDocument();
  });

  it('allows an Organization Admin to sign in and enter the protected app shell', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockImplementation((url) => {
      if (url === '/auth/refresh') return Promise.reject(new ApiError({ status: 401, detail: 'Sessão inválida.', code: 'HTTP_401' }));
      return Promise.resolve({ data: { accessToken: 'access-token', expiresIn: 900, tokenType: 'Bearer' } }) as never;
    });
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Entrar na oficina' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Sua oficina está pronta' })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'ana@example.com', password: 'correct horse battery staple' });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('shows safe invalid-credential feedback and prevents duplicate submission', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 401, detail: 'The request could not be completed.', code: 'HTTP_401' }));

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Entrar na oficina' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'wrong password');
    const submit = screen.getByRole('button', { name: 'Entrar' });
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('The request could not be completed.');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('keeps the submit action pending while login is in progress', async () => {
    const user = userEvent.setup();
    let resolveLogin!: (value: unknown) => void;
    const post = vi.spyOn(httpClient, 'post').mockImplementation((url) => {
      if (url === '/auth/refresh') return Promise.reject(new ApiError({ status: 401, detail: 'Sessão inválida.', code: 'HTTP_401' }));
      return new Promise((resolve) => { resolveLogin = resolve; }) as never;
    });
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Entrar na oficina' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'correct horse battery staple');
    const submit = screen.getByRole('button', { name: 'Entrar' });
    void user.click(submit);
    expect(await screen.findByRole('button', { name: 'Entrando…' })).toBeDisabled();
    await user.click(submit);
    expect(post).toHaveBeenCalledTimes(2);
    resolveLogin({ data: { accessToken: 'access-token', expiresIn: 900, tokenType: 'Bearer' } });
  });

  it('shows a safe message for an unexpected login failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'post').mockRejectedValue(new Error('network detail'));

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Entrar na oficina' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar agora.');
    expect(screen.queryByText('network detail')).not.toBeInTheDocument();
  });

  it('does not render protected content for an unauthenticated visitor', async () => {
    vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 401, detail: 'Sessão inválida.', code: 'HTTP_401' }));
    render(<AppProviders />);
    expect(screen.queryByRole('heading', { name: 'Sua oficina está pronta' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Entrar na oficina' })).toBeInTheDocument();
  });

  it('clears the local session when logout cannot reach the server', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'post').mockImplementation((url) => {
      if (url === '/auth/refresh') return Promise.reject(new ApiError({ status: 401, detail: 'Sessão inválida.', code: 'HTTP_401' }));
      if (url === '/auth/login') return Promise.resolve({ data: { accessToken: 'access-token', expiresIn: 900, tokenType: 'Bearer' } }) as never;
      return Promise.reject(new Error('offline'));
    });
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Entrar na oficina' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Sua oficina está pronta' });
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar na oficina' })).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });
});

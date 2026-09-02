import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from './providers/app-providers';
import { ApiError, getAccessToken, httpClient, setAccessToken } from '@/shared/api/http';

const principal = { id: 'user-1', name: 'Ana Admin', email: 'ana@example.com', role: 'ADMIN' as const, organizationId: 'org-1' };
const superAdmin = { id: 'user-2', name: 'Sofia Platform', email: 'sofia@example.com', role: 'SUPER_ADMIN' as const, organizationId: null };

describe('Organization Admin frontend shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('restores the browser session before rendering protected content', async () => {
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: principal }) as never;
      return Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 } } }) as never;
    });

    render(<AppProviders />);

    expect(screen.queryByRole('heading', { name: 'Sua oficina está pronta' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sua oficina está pronta' }, { timeout: 5_000 })).toBeInTheDocument();
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

  it('attempts logout while the access token is still available', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockImplementation((url) => {
      if (url === '/auth/refresh') return Promise.reject(new ApiError({ status: 401, detail: 'Sessão inválida.', code: 'HTTP_401' }));
      if (url === '/auth/login') return Promise.resolve({ data: { accessToken: 'access-token', expiresIn: 900, tokenType: 'Bearer' } }) as never;
      return Promise.resolve({ data: { success: true } }) as never;
    });
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Entrar na oficina' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Sua oficina está pronta' });
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(post).toHaveBeenCalledWith('/auth/logout');
    expect(getAccessToken()).toBeNull();
  });

  it('sends a restored Super Admin to the separate platform shell', async () => {
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: superAdmin } as never);

    render(<AppProviders />);

    expect(await screen.findByRole('heading', { name: 'Painel da plataforma' })).toBeInTheDocument();
    expect(screen.getByText('Área da plataforma')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sua oficina está pronta' })).not.toBeInTheDocument();
  });

  it('redirects an Organization Admin away from the platform area without rendering its content', async () => {
    window.history.pushState({}, '', '/platform');
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);

    expect(await screen.findByRole('heading', { name: 'Sua oficina está pronta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Painel da plataforma' })).not.toBeInTheDocument();
  });

  it('redirects a Super Admin away from the organization area without rendering its content', async () => {
    window.history.pushState({}, '', '/app');
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: superAdmin } as never);

    render(<AppProviders />);

    expect(await screen.findByRole('heading', { name: 'Painel da plataforma' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sua oficina está pronta' })).not.toBeInTheDocument();
  });

  it('lets a Super Admin sign out from the platform shell', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: superAdmin } as never);

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Painel da plataforma' });
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar na oficina' })).toBeInTheDocument();
  });

  it('uses the canonical platform dashboard route and keeps platform navigation operational-data free', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/platform');
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: superAdmin } as never);
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);

    render(<AppProviders />);
    expect(await screen.findByRole('heading', { name: 'Painel da plataforma' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/platform/dashboard');
    await user.click(screen.getByRole('link', { name: 'Organizations' }));
    expect(await screen.findByRole('heading', { name: 'Organizations', level: 2 })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/customers|vehicles|quotes|work-orders|payments/));
  });

  it('keeps the layout and module navigation persistent while marking the active route', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: principal }) as never;
      if (url === '/customers') return Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 1, total: 7, totalPages: 7 } } }) as never;
      return Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } }) as never;
    });

    render(<AppProviders />);
    expect(await screen.findByRole('heading', { name: 'Sua oficina está pronta' })).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Módulos da oficina' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('link', { name: 'Clientes' }));

    expect(await screen.findByRole('heading', { name: 'Clientes', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Módulos da oficina' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('link', { name: 'Financeiro' }));
    expect(await screen.findByRole('heading', { name: 'Financeiro', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Em breve')).toBeInTheDocument();
  });

  it('opens and closes the mobile drawer with its close button, backdrop, and Escape', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Sua oficina está pronta' });
    const openMenu = screen.getByRole('button', { name: 'Abrir menu' });
    await user.click(openMenu);
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Navegação principal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fechar menu sobreposto' }));
    expect(screen.queryByRole('button', { name: 'Fechar menu' })).not.toBeInTheDocument();
    expect(openMenu).toHaveFocus();
    await user.click(openMenu);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Fechar menu' })).not.toBeInTheDocument();
    expect(openMenu).toHaveFocus();
  });

  it('shows the role returned by the backend in the user menu', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Sua oficina está pronta' });
    await user.click(screen.getByRole('button', { name: /Ana Admin/ }));

    expect(screen.getByText('Administrador da oficina')).toBeInTheDocument();
  });

  it('logs out from the user menu and returns to the public login route', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { accessToken: 'restored-token', expiresIn: 900, tokenType: 'Bearer' } } as never);
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: principal } as never);

    render(<AppProviders />);
    await screen.findByRole('heading', { name: 'Sua oficina está pronta' });
    await user.click(screen.getByRole('button', { name: /Ana Admin/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(post).toHaveBeenCalledWith('/auth/logout');
    expect(await screen.findByRole('heading', { name: 'Entrar na oficina' })).toBeInTheDocument();
  });
});

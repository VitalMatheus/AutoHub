import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpClient } from '@/shared/api/http';
import { ProvisionCommercialAccountPage } from './pages/provision-commercial-account-pages';

const created = {
  organization: { id: 'org-1', name: 'Oficina Recife', operationalStatus: 'ACTIVE' },
  admin: { id: 'user-1', name: 'Ana Lima', email: 'ana@motor.test', role: 'ADMIN', status: 'PENDING_ACTIVATION' },
  activationSecret: 'secret-only-once',
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);
const renderPage = () => render(
  <MemoryRouter initialEntries={['/platform/organizations/new']}>
    <Routes>
      <Route path="/platform/organizations/new" element={<ProvisionCommercialAccountPage />} />
      <Route path="/platform/organizations" element={<p>Lista de oficinas</p>} />
    </Routes>
  </MemoryRouter>,
  { wrapper },
);

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nome da oficina'), 'Oficina Recife');
  await user.type(screen.getByLabelText('Telefone da oficina'), '(81) 99999-0000');
  await user.type(screen.getByLabelText('Nome do administrador'), 'Ana Lima');
  await user.type(screen.getByLabelText('E-mail do administrador'), 'ana@motor.test');
  await user.type(screen.getByLabelText('Primeiro vencimento'), '2026-10-10');
}

describe('Cadastro simples de oficina', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('cadastra oficina e configuração comercial em uma única chamada sem expor conceitos internos', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(httpClient, 'get');
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: created } as never);
    renderPage();

    expect(screen.getByRole('heading', { name: 'Cadastrar oficina' })).toBeInTheDocument();
    expect(screen.getByLabelText('Preço contratado')).toHaveValue('79.00');
    expect(screen.queryByText(/Commercial Account|Plan Version|Subscription|Trial/i)).not.toBeInTheDocument();
    await fillRequired(user);
    await user.type(screen.getByLabelText('Documento'), '12.345.678/0001-90');
    await user.type(screen.getByLabelText('Endereço'), 'Rua do Sol, 100');
    await user.type(screen.getByLabelText('Complemento'), 'Galpão B');
    await user.type(screen.getByLabelText('Cidade'), 'Recife');
    await user.type(screen.getByLabelText('Estado'), 'PE');
    await user.type(screen.getByLabelText('CEP'), '50000-000');
    await user.type(screen.getByLabelText('Observações'), 'Contato prefere WhatsApp');
    await user.click(screen.getByRole('button', { name: 'Cadastrar oficina' }));

    expect(get).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith('/platform/organizations', {
      name: 'Oficina Recife',
      phone: '(81) 99999-0000',
      admin: { name: 'Ana Lima', email: 'ana@motor.test' },
      contractedPrice: '79.00',
      firstDueDate: '2026-10-10',
      billingDay: 10,
      document: '12.345.678/0001-90',
      addressLine1: 'Rua do Sol, 100',
      addressLine2: 'Galpão B',
      city: 'Recife',
      state: 'PE',
      postalCode: '50000-000',
      notes: 'Contato prefere WhatsApp',
    });
    expect(await screen.findByText('Segredo de ativação')).toBeInTheDocument();
    expect(screen.getByDisplayValue('secret-only-once')).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain('secret-only-once');
  });

  it('exige os dados essenciais e limita o vencimento aos dias 1 a 28', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post');
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Cadastrar oficina' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha os campos obrigatórios');
    expect(post).not.toHaveBeenCalled();

    await fillRequired(user);
    await user.clear(screen.getByLabelText('Primeiro vencimento'));
    await user.type(screen.getByLabelText('Primeiro vencimento'), '2026-10-29');
    await user.click(screen.getByRole('button', { name: 'Cadastrar oficina' }));
    expect(screen.getByRole('alert')).toHaveTextContent('O vencimento mensal deve ocorrer entre os dias 1 e 28.');
    expect(post).not.toHaveBeenCalled();
  });

  it('preserva o formulário quando a API rejeita o cadastro', async () => {
    const user = userEvent.setup();
    vi.spyOn(httpClient, 'post').mockRejectedValue(new ApiError({ status: 409, code: 'ORGANIZATION_ALREADY_EXISTS', detail: 'Organization already exists.' }));
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Cadastrar oficina' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível cadastrar a oficina.');
    expect(screen.getByLabelText('Nome da oficina')).toHaveValue('Oficina Recife');
  });
});

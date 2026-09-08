import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationPage } from './registration-page';
import { submitRegistration } from './api/public-registration-api';

vi.mock('./api/public-registration-api', () => ({ submitRegistration: vi.fn() }));

describe('cadastro público', () => {
  beforeEach(() => vi.mocked(submitRegistration).mockReset());

  it('collects the required workshop data without promotional consent', async () => {
    vi.mocked(submitRegistration).mockResolvedValue({ data: { message: 'neutral' } } as never);
    render(<MemoryRouter><RegistrationPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nome da oficina'), { target: { value: 'Oficina Central' } });
    fireEvent.change(screen.getByLabelText('CPF ou CNPJ'), { target: { value: '529.982.247-25' } });
    fireEvent.change(screen.getByLabelText('Telefone da oficina'), { target: { value: '81999999999' } });
    fireEvent.change(screen.getByLabelText('Nome da pessoa responsável'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/E-mail de contato da oficina/), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'a-secure-password' } });
    fireEvent.click(screen.getByLabelText(/Termos de Uso/));
    fireEvent.click(screen.getByLabelText(/Política de Privacidade/));
    fireEvent.click(screen.getByRole('button', { name: 'Criar cadastro' }));
    await waitFor(() => expect(submitRegistration).toHaveBeenCalledWith(expect.objectContaining({ termsAccepted: true, privacyAccepted: true })));
    expect(submitRegistration).toHaveBeenCalledWith(expect.not.objectContaining({ marketingConsent: expect.anything() }));
    expect(await screen.findByRole('status')).toHaveTextContent('Cadastro recebido');
  });

  it('aplica máscaras ao documento e ao telefone', () => {
    render(<MemoryRouter><RegistrationPage /></MemoryRouter>);

    const document = screen.getByLabelText('CPF ou CNPJ');
    const phone = screen.getByLabelText('Telefone da oficina');
    fireEvent.change(document, { target: { value: '52998224725' } });
    fireEvent.change(phone, { target: { value: '81999999999' } });

    expect(document).toHaveValue('529.982.247-25');
    expect(phone).toHaveValue('(81) 99999-9999');
  });

  it('mostra em português quando o e-mail está inválido e não envia o formulário', async () => {
    render(<MemoryRouter><RegistrationPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nome da oficina'), { target: { value: 'Oficina Central' } });
    fireEvent.change(screen.getByLabelText('CPF ou CNPJ'), { target: { value: '52998224725' } });
    fireEvent.change(screen.getByLabelText('Telefone da oficina'), { target: { value: '81999999999' } });
    fireEvent.change(screen.getByLabelText('Nome da pessoa responsável'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/E-mail de contato da oficina/), { target: { value: 'ana@' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'a-secure-password' } });
    fireEvent.click(screen.getByLabelText(/Termos de Uso/));
    fireEvent.click(screen.getByLabelText(/Política de Privacidade/));
    fireEvent.click(screen.getByRole('button', { name: 'Criar cadastro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe um e-mail válido.');
    expect(submitRegistration).not.toHaveBeenCalled();
  });
});

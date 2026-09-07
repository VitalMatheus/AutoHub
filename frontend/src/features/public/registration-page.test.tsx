import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RegistrationPage } from './registration-page';
import { submitRegistration } from './api/public-registration-api';

vi.mock('./api/public-registration-api', () => ({ submitRegistration: vi.fn() }));

describe('cadastro público', () => {
  it('collects the required workshop data and keeps marketing consent unchecked', async () => {
    vi.mocked(submitRegistration).mockResolvedValue({ data: { message: 'neutral' } } as never);
    render(<MemoryRouter><RegistrationPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nome da oficina'), { target: { value: 'Oficina Central' } });
    fireEvent.change(screen.getByLabelText('CPF ou CNPJ'), { target: { value: '529.982.247-25' } });
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '81999999999' } });
    fireEvent.change(screen.getByLabelText('Nome da pessoa responsável'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'a-secure-password' } });
    fireEvent.click(screen.getByLabelText(/Termos de Uso/));
    fireEvent.click(screen.getByLabelText(/Política de Privacidade/));
    expect(screen.getByLabelText(/novidades/)).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Criar cadastro' }));
    await waitFor(() => expect(submitRegistration).toHaveBeenCalledWith(expect.objectContaining({ termsAccepted: true, privacyAccepted: true, marketingConsent: false })));
    expect(await screen.findByRole('status')).toHaveTextContent('Cadastro recebido');
  });
});

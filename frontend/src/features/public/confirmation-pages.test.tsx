import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmRegistrationPage } from './confirmation-pages';
import { confirmRegistration } from './api/public-registration-api';

vi.mock('./api/public-registration-api', () => ({
  confirmRegistration: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  resendConfirmation: vi.fn(),
}));

describe('confirmação pública', () => {
  it('shows the exact trial end instant returned by the API', async () => {
    vi.mocked(confirmRegistration).mockResolvedValue({ data: { success: true, trialStartsAt: '2026-09-07T12:00:00.000Z', trialEndsAt: '2026-09-21T12:00:00.000Z' } } as never);

    render(<MemoryRouter initialEntries={['/confirmar-email?token=token-valid']}><ConfirmRegistrationPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Seu teste começou' })).toBeInTheDocument();
    expect(screen.getByText(/21\/09\/2026/)).toBeInTheDocument();
    expect(confirmRegistration).toHaveBeenCalledWith('token-valid');
  });
});

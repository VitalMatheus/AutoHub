import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { WorkOrderFinancialActions } from './components/work-order-financial-actions';

function renderActions(openPrompt = false) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><WorkOrderFinancialActions workOrderId="wo-1" openPrompt={openPrompt} /></MemoryRouter></QueryClientProvider>);
}

function renderClosableActions() {
  function Host() {
    const [open, setOpen] = useState(true);
    return <WorkOrderFinancialActions workOrderId="wo-1" openPrompt={open} onClosePrompt={() => setOpen(false)} />;
  }
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Host /></MemoryRouter></QueryClientProvider>);
}

describe('WorkOrderFinancialActions', () => {
  it('links the Work Order to its Finance page', () => {
    renderActions();
    expect(screen.getByRole('link', { name: 'Financeiro da OS' })).toHaveAttribute('href', '/app/finance/work-orders/wo-1');
  });

  it('registers an optional payment after the Work Order transition', async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { id: 'payment-1' } } as never);
    renderActions(true);
    await user.type(screen.getByLabelText('Valor'), '100,00');
    await user.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/work-orders/wo-1/payments', expect.objectContaining({ amount: '100.00', method: 'PIX', status: 'CONFIRMED', paidAt: expect.any(String) })));
  });

  it('allows closing the payment prompt without registering a payment', async () => {
    const user = userEvent.setup();
    renderClosableActions();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

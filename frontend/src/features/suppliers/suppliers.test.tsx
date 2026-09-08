import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { NewSupplierPage, SuppliersListPage } from './pages/supplier-pages';

describe('Suppliers', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists active Suppliers in the Organization area', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [{ id: 'supplier-1', name: 'Distribuidora', document: '12345678000190', email: null, phone: '81999999999', notes: null, active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } } as never);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><SuppliersListPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('Distribuidora')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/suppliers', { params: { page: 1, pageSize: 10, search: undefined, active: true } });
    expect(screen.getByText('12.345.678/0001-90')).toBeInTheDocument();
    expect(screen.getByText('(81) 99999-9999')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar fornecedor' })).not.toBeInTheDocument();
  });

  it('opens the dedicated form with CNPJ and phone masks and validates email', async () => {
    const user = userEvent.setup(); const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { id: 'supplier-2' } } as never);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/app/suppliers/new']}><Routes><Route path="/app/suppliers/new" element={<NewSupplierPage />} /><Route path="/app/suppliers" element={<p>Lista atualizada</p>} /></Routes></MemoryRouter></QueryClientProvider>);
    const fields = screen.getAllByRole('textbox'); await user.type(fields[0], 'Fornecedor Novo'); await user.type(fields[1], '11222333000181'); await user.type(fields[2], '81988887777');
    expect(fields[1]).toHaveValue('11.222.333/0001-81'); expect(fields[2]).toHaveValue('(81) 98888-7777');
    await user.type(fields[3], 'email-invalido'); await user.click(screen.getByRole('button', { name: 'Salvar fornecedor' }));
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument(); expect(post).not.toHaveBeenCalled();
    await user.clear(fields[3]); await user.type(fields[3], 'fornecedor@example.com'); await user.click(screen.getByRole('button', { name: 'Salvar fornecedor' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/suppliers', { name: 'Fornecedor Novo', document: '11222333000181', email: 'fornecedor@example.com', phone: '81988887777' }));
    expect(await screen.findByText('Lista atualizada')).toBeInTheDocument();
  });
});

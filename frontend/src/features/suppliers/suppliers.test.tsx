import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { SuppliersListPage } from './pages/supplier-pages';

describe('Suppliers', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists active Suppliers in the Organization area', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [{ id: 'supplier-1', name: 'Distribuidora', document: '12345678000190', email: null, phone: '81999999999', notes: null, active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } } } as never);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><SuppliersListPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('Distribuidora')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/suppliers', { params: { page: 1, pageSize: 10, search: undefined, active: true } });
  });
});

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@/shared/api/http';
import { ReportsPage } from './pages/reports-page';

describe('Reports page', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders an honest unavailable state without making API requests', () => {
    const get = vi.spyOn(httpClient, 'get');
    const post = vi.spyOn(httpClient, 'post');
    const patch = vi.spyOn(httpClient, 'patch');
    const request = vi.spyOn(httpClient, 'request');

    render(<ReportsPage />);

    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Relatórios em breve' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Indisponível');
    expect(screen.getByText(/Ainda não há dados consolidados disponíveis/)).toBeInTheDocument();
    expect(screen.getByText(/Métricas, receitas, atividades e indicadores/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});

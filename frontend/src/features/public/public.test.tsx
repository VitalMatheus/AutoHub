import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LandingPage, PublicPage } from './public-pages';

function renderPage(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><PublicPage /></MemoryRouter>);
}

describe('superfície pública Vekar', () => {
  it('apresenta a promessa, preço transparente e CTAs públicos', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Sua oficina organizada do orçamento ao pagamento' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Teste grátis por 14 dias' })[0]).toHaveAttribute('href', '/teste-gratis');
    expect(screen.getAllByRole('link', { name: 'Entrar' })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByText('14 dias grátis. Depois, R$ 79/mês.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Perguntas frequentes' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('expande FAQ com teclado e mantém o controle acessível', async () => {
    const user = userEvent.setup();
    renderPage();
    const question = screen.getByRole('button', { name: 'Preciso cadastrar cartão para testar?' });

    question.focus();
    await user.keyboard('{Enter}');

    expect(question).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Não. O teste é gratuito e não pede cartão.')).toBeVisible();
  });

  it('dispara evento de funil sem dados pessoais ao clicar no CTA', () => {
    const event = vi.fn();
    window.addEventListener('vekar:funnel', event);
    renderPage();

    fireEvent.click(screen.getAllByRole('link', { name: 'Teste grátis por 14 dias' })[0]);

    expect(event).toHaveBeenCalled();
    expect((event.mock.calls[0][0] as CustomEvent).detail).toEqual({ name: 'trial_cta_click' });
    window.removeEventListener('vekar:funnel', event);
  });

  it.each(['/precos', '/termos', '/privacidade', '/contato', '/teste-gratis'])('renderiza a rota pública %s', (path) => {
    renderPage(path);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entrar na oficina' })).not.toBeInTheDocument();
  });

  it('não oferece login como destino para uma rota pública desconhecida', () => {
    renderPage('/uma-rota-que-nao-existe');
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para a página inicial' })).toHaveAttribute('href', '/');
  });
});

describe('landing page semântica', () => {
  it('permite navegar pelos links principais com teclado', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const primary = screen.getAllByRole('link', { name: 'Teste grátis por 14 dias' })[0];
    primary.focus();
    expect(primary).toHaveFocus();
    await user.tab();
    expect(document.activeElement).toBeTruthy();
  });

  it('expõe o menu mobile por um controle de teclado', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const menu = screen.getByRole('button', { name: 'Abrir menu' });

    await user.click(menu);

    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Navegação pública' })).toHaveClass('public-nav-open');
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toBeInTheDocument();
  });
});

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ClipboardList, CreditCard, Gauge, Menu, ShieldCheck, Wrench, X } from 'lucide-react';

const primaryCta = 'Teste grátis por 14 dias';

function track(name: string) {
  const detail = { name };
  window.dispatchEvent(new CustomEvent('vekar:funnel', { detail }));
  const dataLayer = (window as Window & { dataLayer?: Array<Record<string, string>> }).dataLayer;
  dataLayer?.push({ event: name });
}

function CtaLink({ className = '' }: { className?: string }) {
  return <Link to="/teste-gratis" onClick={() => track('trial_cta_click')} className={`inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-950/20 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 ${className}`}>{primaryCta}<ArrowRight size={17} aria-hidden="true" /></Link>;
}

function PublicHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <header className="public-header"><div className="public-container flex h-20 items-center justify-between"><Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-white" aria-label="Vekar, página inicial"><span className="grid size-9 place-items-center rounded-xl bg-amber-400 text-slate-950">V</span>vekar</Link><button type="button" className="rounded-lg p-2 text-white md:hidden" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-controls="public-navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button><nav id="public-navigation" aria-label="Navegação pública" className={`${open ? 'public-nav-open' : 'hidden'} absolute left-4 right-4 top-20 z-20 rounded-2xl bg-slate-900 p-4 shadow-xl md:static md:flex md:items-center md:gap-6 md:bg-transparent md:p-0 md:shadow-none`}><a href="#produto" onClick={close}>Produto</a><Link to="/precos" onClick={close}>Preços</Link><a href="#faq" onClick={close}>FAQ</a><Link to="/login" className="public-login" onClick={close}>Entrar</Link><CtaLink className="w-full md:w-auto" /></nav></div></header>;
}

const capabilities = [
  { icon: ClipboardList, title: 'Orçamentos claros', text: 'Monte propostas com serviços, produtos e valores combinados com o cliente.' },
  { icon: Wrench, title: 'Ordens de serviço', text: 'Acompanhe o que foi autorizado, executado e entregue em cada veículo.' },
  { icon: Gauge, title: 'Estoque e compras', text: 'Saiba o que está disponível, o que está acabando e de onde veio cada peça.' },
  { icon: CreditCard, title: 'Financeiro conectado', text: 'Registre recebimentos, despesas e vendas para enxergar o caixa da oficina.' },
];

const faqs = [
  ['Preciso cadastrar cartão para testar?', 'Não. O teste é gratuito e não pede cartão.'],
  ['O que acontece depois dos 14 dias?', 'Você decide se quer continuar com o Plano Básico por R$ 79/mês. Não há cobrança automática durante o teste.'],
  ['Posso cancelar quando quiser?', 'Sim. O plano não tem fidelidade.'],
  ['Meus dados ficam seguros?', 'O acesso é protegido e os dados da sua oficina ficam separados. Consulte a Política de Privacidade para saber mais.'],
  ['Vocês oferecem suporte?', 'Sim. Fale com a equipe pelo canal de contato para tirar dúvidas sobre o produto.'],
];

function PriceDisclosure() { return <p className="price-disclosure"><strong>14 dias grátis.</strong> Depois, <strong>R$ 79/mês.</strong><span>Sem cartão · sem taxa de implantação · sem fidelidade</span></p>; }

export function LandingPage() {
  return <div className="public-site"><PublicHeader /><main>
    <section className="public-hero"><div className="public-container grid items-center gap-12 py-16 md:grid-cols-[1.05fr_.95fr] md:py-24"><div><p className="eyebrow">Gestão de oficina sem complicação</p><h1>Sua oficina organizada do orçamento ao pagamento</h1><p className="hero-copy">Controle clientes, veículos, serviços, estoque e financeiro em um só lugar. Menos planilhas, mais tempo para cuidar do que você faz melhor.</p><div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center"><CtaLink /><Link to="/login" onClick={() => track('login_cta_click')} className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">Entrar</Link></div><PriceDisclosure /></div><div className="hero-visual" aria-label="Resumo visual das etapas de uma oficina" role="img"><div className="visual-top"><span className="dot" /><span className="dot" /><span className="dot" /></div><div className="visual-body"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Visão da oficina</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="visual-card"><ClipboardList size={18} /><strong>Orçamentos</strong><span>Organizados</span></div><div className="visual-card"><Wrench size={18} /><strong>Em serviço</strong><span>Acompanhados</span></div><div className="visual-card"><CreditCard size={18} /><strong>Recebimentos</strong><span>Registrados</span></div><div className="visual-card"><Check size={18} /><strong>Histórico</strong><span>Preservado</span></div></div></div></div></div></section>
    <section className="public-section bg-white"><div className="public-container"><div className="section-intro"><p className="eyebrow dark">Feito para a rotina real</p><h2>O dia a dia já é corrido. A gestão não precisa ser.</h2></div><div className="grid gap-4 md:grid-cols-3"><article className="problem-card"><span>01</span><h3>Informação espalhada</h3><p>Quando cada anotação fica em um lugar, encontrar o histórico vira uma tarefa.</p></article><article className="problem-card"><span>02</span><h3>Orçamento sem acompanhamento</h3><p>Uma proposta só ajuda quando você sabe o que foi aprovado e o que está em andamento.</p></article><article className="problem-card"><span>03</span><h3>Caixa difícil de enxergar</h3><p>Recebimentos, despesas e estoque precisam conversar para apoiar suas decisões.</p></article></div></div></section>
    <section id="produto" className="public-section"><div className="public-container"><div className="section-intro"><p className="eyebrow dark">Tudo no mesmo lugar</p><h2>Capacidades que já fazem parte do Vekar</h2><p>Ferramentas práticas para acompanhar sua operação com clareza, do primeiro contato à entrega.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{capabilities.map(({ icon: Icon, title, text }) => <article className="capability-card" key={title}><Icon size={24} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    <section className="public-section bg-slate-900 text-white"><div className="public-container"><div className="section-intro"><p className="eyebrow">Comece simples</p><h2>Como funciona</h2></div><div className="grid gap-8 md:grid-cols-3"><article className="step"><span>1</span><h3>Organize sua base</h3><p>Cadastre clientes, veículos, serviços e produtos conforme sua rotina.</p></article><article className="step"><span>2</span><h3>Acompanhe cada serviço</h3><p>Transforme o orçamento aprovado em trabalho acompanhado até a entrega.</p></article><article className="step"><span>3</span><h3>Feche o ciclo</h3><p>Registre pagamentos e despesas para tomar decisões com mais segurança.</p></article></div></div></section>
    <section id="precos" className="public-section"><div className="public-container grid items-center gap-10 md:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow dark">Um plano para começar</p><h2>Plano Básico</h2><p>Tenha todas as capacidades atuais para uma oficina e até três administradores.</p></div><div className="price-card"><p className="text-sm font-bold uppercase tracking-widest text-blue-700">Plano Básico</p><p className="price">R$ 79<span>/mês</span></p><p className="font-semibold text-slate-700">14 dias grátis. Depois, R$ 79/mês.</p><ul>{['Clientes e veículos sem limites artificiais', 'Orçamentos e ordens de serviço', 'Produtos, serviços, fornecedores e compras', 'Financeiro, recebimentos e relatórios'].map((item) => <li key={item}><Check size={18} aria-hidden="true" />{item}</li>)}</ul><CtaLink className="w-full" /></div></div></section>
    <section id="faq" className="public-section bg-white"><div className="public-container max-w-3xl"><div className="section-intro"><p className="eyebrow dark">Dúvidas comuns</p><h2>Perguntas frequentes</h2></div><div className="faq-list">{faqs.map(([question, answer]) => <FaqItem key={question} question={question} answer={answer} />)}</div></div></section>
    <section className="final-cta"><div className="public-container text-center"><ShieldCheck className="mx-auto text-amber-300" aria-hidden="true" /><h2>Mais clareza para tocar sua oficina</h2><p>Conheça o Vekar e veja como a sua rotina pode ficar mais organizada.</p><CtaLink /></div></section>
  </main><PublicFooter /></div>;
}

function FaqItem({ question, answer }: { question: string; answer: string }) { const [open, setOpen] = useState(false); return <div className="faq-item"><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{question}<ChevronDown size={19} aria-hidden="true" className={open ? 'rotate-180' : ''} /></button>{open && <p>{answer}</p>}</div>; }

export function PublicFooter() { return <footer className="public-footer" role="contentinfo"><div className="public-container flex flex-col gap-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-lg text-white">vekar</strong><p className="mt-1">Gestão de oficina feita para você.</p></div><nav aria-label="Links legais" className="flex flex-wrap gap-x-5 gap-y-2"><Link to="/precos">Preços</Link><Link to="/termos">Termos de Uso</Link><Link to="/privacidade">Privacidade</Link><Link to="/contato">Contato</Link></nav></div></footer>; }

const pageCopy: Record<string, { title: string; intro: string; body: string }> = {
  '/precos': { title: 'Preços simples e transparentes', intro: '14 dias grátis. Depois, R$ 79/mês.', body: 'O Plano Básico inclui as capacidades atuais do Vekar para sua oficina, sem taxa de implantação e sem fidelidade.' },
  '/termos': { title: 'Termos de Uso', intro: 'Versão 0.1 · conteúdo sujeito à revisão jurídica.', body: 'Estes Termos de Uso apresentam as regras para utilizar o Vekar, incluindo cadastro, acesso, período de teste, contratação, cancelamento e responsabilidades. A versão final revisada será publicada antes do lançamento comercial.' },
  '/privacidade': { title: 'Política de Privacidade', intro: 'Versão 0.1 · conteúdo sujeito à revisão jurídica.', body: 'O Vekar trata dados para oferecer a gestão da oficina, proteger o acesso, operar o período de teste e prestar suporte. Dados de oficinas não são enviados aos eventos de funil. A versão final revisada explicará bases legais, direitos, retenção, exclusão e contatos do controlador.' },
  '/contato': { title: 'Fale com o Vekar', intro: 'Atendimento comercial e dúvidas sobre o produto.', body: 'O atendimento será oferecido por e-mail e WhatsApp em horário comercial. Os endereços oficiais serão publicados nesta página antes da abertura do cadastro público.' },
  '/teste-gratis': { title: 'Teste grátis por 14 dias', intro: 'Sem cartão e sem compromisso.', body: 'O cadastro público será conectado nesta rota na próxima etapa. Enquanto isso, você já pode conhecer o produto e conferir as condições do Plano Básico.' },
};

export function PublicPage() { const { pathname } = useLocation(); if (pathname === '/') return <LandingPage />; const copy = pageCopy[pathname]; if (!copy) return <div className="public-site"><PublicHeader /><main className="public-simple-page"><div className="public-container"><h1>Página não encontrada</h1><p>Esse endereço não existe.</p><Link className="simple-link" to="/">Voltar para a página inicial</Link></div></main><PublicFooter /></div>; return <div className="public-site"><PublicHeader /><main className="public-simple-page"><div className="public-container"><p className="eyebrow dark">Vekar</p><h1>{copy.title}</h1><p className="simple-intro">{copy.intro}</p><p>{copy.body}</p>{pathname !== '/contato' && <CtaLink className="mt-8" />}</div></main><PublicFooter /></div>; }

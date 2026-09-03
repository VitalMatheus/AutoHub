import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CarFront, ChevronDown, ClipboardList, DollarSign, LayoutDashboard, LogOut, Menu, Package, Settings, Tags, Users, Wrench, X, BarChart3, Truck } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/shared/utils/cn';

const navigation = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { to: '/app/customers', label: 'Clientes', icon: Users }, { to: '/app/vehicles', label: 'Veículos', icon: CarFront }, { to: '/app/quotes', label: 'Orçamentos', icon: ClipboardList }, { to: '/app/work-orders', label: 'Ordens de Serviço', icon: Wrench }, { to: '/app/products', label: 'Produtos', icon: Package }, { to: '/app/services', label: 'Serviços', icon: Tags }, { to: '/app/suppliers', label: 'Fornecedores', icon: Truck }, { to: '/app/finance', label: 'Financeiro', icon: DollarSign }, { to: '/app/reports', label: 'Relatórios', icon: BarChart3 }, { to: '/app/settings', label: 'Configurações', icon: Settings },
];

function Sidebar({ open, onClose, triggerRef }: { open: boolean; onClose: () => void; triggerRef: React.RefObject<HTMLButtonElement | null> }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeButtonRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !closeButtonRef.current) return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>('#mobile-navigation a, #mobile-navigation button'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  return <>
    {open && <button aria-label="Fechar menu sobreposto" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={onClose} />}
    <aside id="mobile-navigation" className={cn('fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 text-slate-300 transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')} aria-label="Navegação principal" role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined}>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-6"><Link to="/app/dashboard" className="flex items-center gap-3 text-white" onClick={onClose}><span className="grid size-9 place-items-center rounded-xl bg-blue-500 font-bold">A</span><span><strong className="block text-lg tracking-tight">AutoHub</strong><small className="text-xs text-slate-400">Gestão de oficina</small></span></Link>{open && <button ref={closeButtonRef} type="button" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" onClick={onClose} aria-label="Fechar menu"><X size={20} /></button>}</div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Módulos da oficina">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/app/dashboard'} onClick={onClose} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-950/20' : 'hover:bg-white/10 hover:text-white')}><Icon size={18} aria-hidden="true" />{label}</NavLink>)}</nav>
      <div className="border-t border-white/10 p-4 text-xs text-slate-500">Organization Admin</div>
    </aside>
  </>;
}

export function AppLayout() {
  const { principal, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); const [userMenuOpen, setUserMenuOpen] = useState(false); const mobileMenuButtonRef = useRef<HTMLButtonElement>(null); const location = useLocation();
  const currentPage = navigation.find((item) => location.pathname.startsWith(item.to))?.label ?? 'Dashboard';
  useEffect(() => { setMobileMenuOpen(false); setUserMenuOpen(false); }, [location.pathname]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, []);
  const roleLabel = principal?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Administrador da oficina';
  return <div className="min-h-screen bg-slate-100 text-slate-950"><Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} triggerRef={mobileMenuButtonRef} /><div className="lg:pl-72"><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><button ref={mobileMenuButtonRef} type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menu" aria-controls="mobile-navigation" aria-expanded={mobileMenuOpen}><Menu size={22} /></button><div><p className="text-sm text-slate-500">Área da oficina</p><h1 className="text-lg font-semibold text-slate-900">{currentPage}</h1></div></div><div className="flex items-center gap-3"><button type="button" onClick={() => void signOut()} className="hidden text-sm font-medium text-slate-500 hover:text-red-600 sm:block">Sair</button><div className="relative"><button type="button" className="flex items-center gap-2 rounded-xl p-2 text-left hover:bg-slate-100" onClick={() => setUserMenuOpen((open) => !open)} aria-expanded={userMenuOpen} aria-haspopup="menu"><span className="grid size-9 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{principal?.name?.slice(0, 1).toUpperCase()}</span><span className="hidden sm:block"><strong className="block text-sm">{principal?.name}</strong><small className="block text-xs text-slate-500">{roleLabel}</small></span><ChevronDown size={16} className="text-slate-400" /></button>{userMenuOpen && <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl" role="menu"><div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">{principal?.email}</div><button type="button" role="menuitem" className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => void signOut()}><LogOut size={16} />Sair</button></div>}</div></div></div></header><main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8"><Outlet /></main></div></div>;
}

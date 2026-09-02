import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, CreditCard, FileClock, LayoutDashboard, LogOut, Menu, Receipt, Users, X, BriefcaseBusiness } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/shared/utils/cn';

const navigation = [
  { to: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/platform/organizations', label: 'Organizations', icon: Building2 },
  { to: '/platform/users', label: 'Users', icon: Users },
  { to: '/platform/commercial-accounts', label: 'Commercial Accounts', icon: BriefcaseBusiness },
  { to: '/platform/plans', label: 'Plans', icon: CreditCard },
  { to: '/platform/subscriptions', label: 'Subscriptions', icon: Receipt },
  { to: '/platform/charges', label: 'Subscription Charges', icon: CreditCard },
  { to: '/platform/audit-events', label: 'Audit Events', icon: FileClock },
];

export function PlatformLayout() {
  const { principal, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const currentPage = navigation.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))?.label ?? 'Visão geral';
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  useEffect(() => { if (open) closeRef.current?.focus(); else triggerRef.current?.focus(); }, [open]);
  return <div className="min-h-screen bg-slate-100 text-slate-950">
    {open && <button aria-label="Fechar navegação sobreposta" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} />}
    <aside id="platform-navigation" className={cn('fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 text-slate-300 transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')} aria-label="Navegação da plataforma" role={open ? 'dialog' : undefined} aria-modal={open || undefined}>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-6"><Link to="/platform/dashboard" className="flex items-center gap-3 text-white"><span className="grid size-9 place-items-center rounded-xl bg-violet-500 font-bold">A</span><span><strong className="block text-lg tracking-tight">AutoHub</strong><small className="text-xs text-slate-400">Administração da plataforma</small></span></Link>{open && <button ref={closeRef} type="button" className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar navegação"><X size={20} /></button>}</div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Módulos da plataforma">{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/30' : 'hover:bg-white/10 hover:text-white')}><Icon size={18} aria-hidden="true" />{label}</NavLink>)}</nav>
      <div className="border-t border-white/10 p-4 text-xs text-slate-500">Super Admin</div>
    </aside>
    <div className="lg:pl-72"><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><button ref={triggerRef} type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir navegação" aria-controls="platform-navigation" aria-expanded={open}><Menu size={22} /></button><div><p className="text-sm text-slate-500">Área da plataforma</p><h1 className="text-lg font-semibold">{currentPage}</h1></div></div><div className="flex items-center gap-4"><div className="hidden text-right sm:block"><strong className="block text-sm">{principal?.name}</strong><small className="text-xs text-slate-500">Super Admin</small></div><button type="button" onClick={() => void signOut()} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"><LogOut size={17} aria-hidden="true" />Sair</button></div></div></header><main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8"><Outlet /></main></div>
  </div>;
}

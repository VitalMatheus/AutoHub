import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CarFront, ClipboardList, Plus, Users, Wrench, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchWorkshopDashboard } from '@/features/dashboard/api/workshop-dashboard-api';

const quickActions = [
  { label: 'Novo cliente', to: '/app/customers/new', icon: Users, available: true },
  { label: 'Novo veículo', to: '/app/vehicles/new', icon: CarFront, available: true },
  { label: 'Novo orçamento', to: '/app/quotes/new', icon: ClipboardList, available: true },
  { label: 'Nova ordem de serviço', to: '/app/work-orders/new', icon: Wrench, available: true },
];

function currentDateKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function trialDismissalKey(organizationId: string): string {
  return `vekar:trial-banner-dismissed:${organizationId}`;
}

export function AppHomePage() {
  const workshop = useQuery({ queryKey: ['workshop-dashboard'], queryFn: fetchWorkshopDashboard, refetchOnMount: 'always', refetchInterval: 15000 });
  const [dismissedTrialKey, setDismissedTrialKey] = useState<string | null>(null);
  const trialExpired = workshop.data?.trial?.status === 'EXPIRED';
  const readOnly = trialExpired;
  const trialKey = workshop.data?.organization?.id ? trialDismissalKey(workshop.data.organization.id) : null;
  const trialDismissed = trialKey ? dismissedTrialKey === `${trialKey}:${currentDateKey()}` : false;
  const dismissTrial = () => {
    if (!trialKey) return;
    const dismissal = `${trialKey}:${currentDateKey()}`;
    localStorage.setItem(trialKey, dismissal);
    setDismissedTrialKey(dismissal);
  };
  const storedDismissal = trialKey ? localStorage.getItem(trialKey) : null;
  const shouldShowTrial = Boolean(workshop.data?.trial && !trialDismissed && storedDismissal !== `${trialKey}:${currentDateKey()}`);
  return <section aria-labelledby="app-shell-title" className="space-y-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Visão geral</p><h2 id="app-shell-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Sua oficina está pronta</h2><p className="mt-2 text-slate-600">Acompanhe a operação e acesse rapidamente os módulos da oficina.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${readOnly ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{readOnly ? 'Modo somente leitura' : 'Sistema operacional'}</span></div>{shouldShowTrial && workshop.data?.trial && <section className={`rounded-2xl border p-5 ${workshop.data.trial.status === 'ACTIVE' ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'}`} aria-label="Status do período de teste"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">{workshop.data.trial.status === 'ACTIVE' ? 'Seu período de teste está ativo' : 'Seu período de teste terminou'}</h2><p className="mt-1 text-sm text-slate-700">{workshop.data.trial.status === 'ACTIVE' ? `Seu período de teste termina em ${workshop.data.trial.remainingDays} ${workshop.data.trial.remainingDays === 1 ? 'dia' : 'dias'}.` : 'Seu período de teste terminou.'}</p><p className="mt-1 text-xs text-slate-600">Término: {new Date(workshop.data.trial.endsAt).toLocaleString('pt-BR', { timeZone: workshop.data.timezone })}</p></div><div className="flex items-start gap-3">{workshop.data.trial.status === 'ACTIVE' && <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-blue-700">{workshop.data.trial.remainingDays} {workshop.data.trial.remainingDays === 1 ? 'dia restante' : 'dias restantes'}</span>}<button type="button" onClick={dismissTrial} aria-label="Fechar aviso do período de teste" className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><X size={18} aria-hidden="true" /></button></div></div></section>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Clientes cadastrados" value={workshop.data?.metrics?.customers ?? '…'} detail="Clientes ativos" icon={Users} /><MetricCard label="Veículos" value={workshop.data?.metrics?.vehicles ?? '…'} detail="Veículos ativos" icon={CarFront} /><MetricCard label="Orçamentos" value={workshop.data?.metrics?.quotes ?? '…'} detail="Rascunhos e pendentes" icon={ClipboardList} /><MetricCard label="Ordens de serviço" value={workshop.data?.metrics?.workOrders ?? '…'} detail="Em aberto" icon={Wrench} /></div><div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="text-base font-semibold">Ações rápidas</h3><p className="mt-1 text-sm text-slate-500">Comece uma nova operação.</p></div><Plus size={20} className="text-blue-600" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{quickActions.map(({ label, to, icon: Icon, available }) => available && !readOnly ? <Link key={label} to={to!} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm font-medium hover:border-blue-300 hover:bg-blue-50"><span className="flex items-center gap-3"><Icon size={18} className="text-blue-600" />{label}</span><ArrowRight size={16} className="text-slate-400" /></Link> : <button key={label} type="button" disabled className="flex cursor-not-allowed items-center justify-between rounded-xl border border-slate-200 p-4 text-left text-sm font-medium text-slate-400"><span className="flex items-center gap-3"><Icon size={18} />{label}</span><span className="text-xs font-semibold">{readOnly ? 'Somente leitura' : 'Em breve'}</span></button>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-base font-semibold">Atividades recentes</h3>{workshop.data?.activities?.length ? <div className="mt-5 max-h-44 overflow-y-auto pr-2"><ul className="divide-y divide-slate-100">{workshop.data.activities.map((activity) => <li key={`${activity.type}-${activity.occurredAt}-${activity.href}`} className="py-3 first:pt-0 last:pb-0"><Link to={activity.href} className="block rounded-lg px-2 py-1 hover:bg-slate-50"><span className="block text-sm font-semibold text-slate-800">{activity.label}</span><span className="block text-sm text-slate-600">{activity.description}</span><time className="mt-1 block text-xs text-slate-400" dateTime={activity.occurredAt}>{new Date(activity.occurredAt).toLocaleString('pt-BR')}</time></Link></li>)}</ul></div> : <div className="mt-6 rounded-xl bg-slate-50 p-5 text-center"><p className="text-sm font-medium text-slate-600">Nenhuma atividade recente</p><p className="mt-1 text-xs text-slate-500">As novas movimentações da oficina aparecerão aqui.</p></div>}</div></div></section>;
}
function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof Users }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon size={20} /></span><span className="text-2xl font-bold text-slate-950">{value}</span></div><p className="mt-5 text-sm font-medium text-slate-700">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; }

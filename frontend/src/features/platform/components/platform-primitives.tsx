import { useId, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from 'lucide-react';
import { getUserFacingError, type ProblemDetails } from '@/shared/api/http';

export function PlatformLoading({ label = 'Carregando…' }: { label?: string }) {
  return <div role="status" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600"><LoaderCircle className="animate-spin text-violet-600" size={20} aria-hidden="true" />{label}</div>;
}

export function PlatformEmpty({ title, description }: { title: string; description?: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Info className="mx-auto text-slate-400" size={28} aria-hidden="true" /><h2 className="mt-3 text-lg font-semibold">{title}</h2>{description && <p className="mt-2 text-sm text-slate-500">{description}</p>}</div>;
}

export function PlatformError({ error, fallback = 'Não foi possível carregar esta área.', onRetry }: { error?: unknown; fallback?: string; onRetry?: () => void }) {
  const problem = error && typeof error === 'object' && 'problem' in error ? (error as { problem: Pick<ProblemDetails, 'status' | 'detail' | 'code'> }).problem : undefined;
  const message = problem ? getUserFacingError(problem, fallback) : fallback;
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><div className="flex items-start gap-3"><AlertCircle size={20} aria-hidden="true" /><div><h2 className="font-semibold">Algo deu errado</h2><p className="mt-1 text-sm">{message}</p>{onRetry && <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800">Tentar novamente</button>}</div></div></div>;
}

export function PlatformStatus({ status, tone = 'neutral' }: { status: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const tones = { neutral: 'bg-slate-100 text-slate-700', success: 'bg-emerald-100 text-emerald-800', warning: 'bg-amber-100 text-amber-800', danger: 'bg-red-100 text-red-800' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}><CheckCircle2 size={13} className="mr-1" aria-hidden="true" />{status}</span>;
}

export function PlatformConfirmation({ title, description, confirmLabel = 'Confirmar', onConfirm, onCancel }: { title: string; description: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  const titleId = useId();
  return <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-600">{description}</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Cancelar</button><button type="button" onClick={onConfirm} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">{confirmLabel}</button></div></div>;
}

export function PlatformSection({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

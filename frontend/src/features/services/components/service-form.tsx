import { FormEvent, useState } from 'react';
import type { ServiceInput } from '../api/services-api';
import { ApiError, getUserFacingError } from '@/shared/api/http';
import { isValidMoney, normalizeMoney } from '@/features/shared/money';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2';

export function ServiceForm({ initial, submitting = false, omitEmptyOptional = true, onSubmit, onCancel }: { initial?: Partial<ServiceInput>; submitting?: boolean; omitEmptyOptional?: boolean; onSubmit: (value: ServiceInput) => Promise<unknown>; onCancel: () => void }) {
  const [value, setValue] = useState<ServiceInput>({ name: initial?.name ?? '', description: initial?.description ?? '', price: initial?.price ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceInput, string>>>({});
  const [apiError, setApiError] = useState('');
  function update(field: keyof ServiceInput, next: string) { setValue((current) => ({ ...current, [field]: next })); setErrors((current) => ({ ...current, [field]: undefined })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Partial<Record<keyof ServiceInput, string>> = {};
    if (!value.name.trim()) next.name = 'Informe o nome.';
    else if (value.name.length > 160) next.name = 'Use no máximo 160 caracteres.';
    if (!isValidMoney(value.price)) next.price = 'Informe um preço decimal válido.';
    if (value.description && value.description.length > 2000) next.description = 'Use no máximo 2000 caracteres.';
    setErrors(next); setApiError(''); if (Object.keys(next).length) return;
    const normalized = { name: value.name.trim(), price: normalizeMoney(value.price), description: value.description?.trim() ?? '' };
    const input: ServiceInput = (omitEmptyOptional ? Object.fromEntries(Object.entries(normalized).filter(([, field]) => field !== '')) : normalized) as ServiceInput;
    try { await onSubmit(input); } catch (error) { setApiError(error instanceof ApiError ? getUserFacingError(error.problem, 'Não foi possível salvar o serviço agora.') : 'Não foi possível salvar o serviço agora.'); }
  }
  return <form onSubmit={submit} className="space-y-6" noValidate>
    {apiError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div>}
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Nome" required error={errors.name}><input autoFocus className={inputClass} value={value.name} onChange={(event) => update('name', event.target.value)} aria-invalid={Boolean(errors.name)} /></Field>
      <Field label="Preço" required error={errors.price}><input className={inputClass} inputMode="decimal" placeholder="0.00" value={value.price} onChange={(event) => update('price', event.target.value)} aria-invalid={Boolean(errors.price)} /></Field>
      <Field label="Descrição" error={errors.description} className="md:col-span-2"><textarea className={inputClass} rows={4} value={value.description} onChange={(event) => update('description', event.target.value)} aria-invalid={Boolean(errors.description)} /></Field>
    </div>
    <div className="flex justify-end gap-3 border-t border-slate-200 pt-5"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</button><button disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Salvando…' : 'Salvar serviço'}</button></div>
  </form>;
}

function Field({ label, required, error, className, children }: { label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode }) { return <label className={`block space-y-1.5 ${className ?? ''}`}><span className="text-sm font-medium text-slate-700">{label}{required ? ' *' : ''}</span>{children}{error && <span className="block text-xs text-red-600">{error}</span>}</label>; }

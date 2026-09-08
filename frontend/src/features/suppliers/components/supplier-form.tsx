import { FormEvent, useEffect, useState } from 'react';
import type { SupplierInput } from '../api/suppliers-api';
import { ApiError, getUserFacingError } from '@/shared/api/http';

type Props = { initial?: Partial<SupplierInput>; submitting?: boolean; onSubmit: (value: SupplierInput) => Promise<unknown>; onCancel?: () => void };
type Errors = Partial<Record<keyof SupplierInput, string>>;

const inputClass = 'mt-2 w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

function digits(value: string, max: number) { return value.replace(/\D/g, '').slice(0, max); }
export function formatCnpj(value: string) { return digits(value, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4').replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5'); }
export function formatPhone(value: string) { const raw = digits(value, 11); if (raw.length <= 2) return raw; if (raw.length <= 10) return raw.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^(\(\d{2}\) \d{4})(\d)/, '$1-$2'); return raw.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^(\(\d{2}\) \d{5})(\d)/, '$1-$2'); }

export function SupplierForm({ initial, submitting = false, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState<SupplierInput>({ name: initial?.name ?? '', document: formatCnpj(initial?.document ?? ''), email: initial?.email ?? '', phone: formatPhone(initial?.phone ?? ''), notes: initial?.notes ?? '' });
  const [errors, setErrors] = useState<Errors>({}); const [apiError, setApiError] = useState('');
  useEffect(() => { setValue({ name: initial?.name ?? '', document: formatCnpj(initial?.document ?? ''), email: initial?.email ?? '', phone: formatPhone(initial?.phone ?? ''), notes: initial?.notes ?? '' }); }, [initial]);
  function update(field: keyof SupplierInput, next: string) { setValue((current) => ({ ...current, [field]: next })); setErrors((current) => ({ ...current, [field]: undefined })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); const nextErrors: Errors = {}; const documentDigits = digits(value.document ?? '', 14); const phoneDigits = digits(value.phone ?? '', 11); const email = (value.email ?? '').trim();
    if (!value.name.trim()) nextErrors.name = 'Informe o nome.';
    if (value.document?.trim() && documentDigits.length !== 14) nextErrors.document = 'Informe um CNPJ válido.';
    if (value.phone?.trim() && ![10, 11].includes(phoneDigits.length)) nextErrors.phone = 'Informe um telefone brasileiro com DDD.';
    if (email && !/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Informe um e-mail válido.';
    setErrors(nextErrors); setApiError(''); if (Object.keys(nextErrors).length) return;
    try { await onSubmit({ name: value.name.trim(), ...(documentDigits ? { document: documentDigits } : {}), ...(email ? { email } : {}), ...(phoneDigits ? { phone: phoneDigits } : {}), ...(value.notes?.trim() ? { notes: value.notes.trim() } : {}) }); }
    catch (error) { if (error instanceof ApiError) setApiError(getUserFacingError(error.problem, 'Não foi possível salvar o fornecedor.')); else setApiError('Não foi possível salvar o fornecedor agora.'); }
  }
  return <form onSubmit={submit} className="space-y-6" noValidate>{apiError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div>}<div className="grid gap-5 md:grid-cols-2"><Field label="Nome" required error={errors.name}><input className={inputClass} autoFocus value={value.name} onChange={(e) => update('name', e.target.value)} aria-invalid={Boolean(errors.name)} /></Field><Field label="CNPJ" error={errors.document}><input className={inputClass} inputMode="numeric" placeholder="00.000.000/0000-00" value={value.document} onChange={(e) => update('document', formatCnpj(e.target.value))} aria-invalid={Boolean(errors.document)} /></Field><Field label="Telefone" error={errors.phone}><input className={inputClass} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={value.phone} onChange={(e) => update('phone', formatPhone(e.target.value))} aria-invalid={Boolean(errors.phone)} /></Field><Field label="E-mail" error={errors.email}><input className={inputClass} type="email" autoComplete="email" value={value.email} onChange={(e) => update('email', e.target.value)} aria-invalid={Boolean(errors.email)} /></Field><Field label="Observações" error={errors.notes} className="items-start md:col-span-2"><textarea className={`${inputClass} min-h-32 resize-y`} rows={6} value={value.notes} onChange={(e) => update('notes', e.target.value)} aria-invalid={Boolean(errors.notes)} /></Field></div><div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">{onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</button>}<button disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Salvando…' : 'Salvar fornecedor'}</button></div></form>;
}

function Field({ label, required, error, className, children }: { label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode }) { return <label className={`block space-y-1.5 ${className ?? ''}`}><span className="block text-sm font-medium text-slate-700">{label}{required ? ' *' : ''}</span>{children}{error && <span className="block text-xs text-red-600">{error}</span>}</label>; }

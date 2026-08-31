import { FormEvent, useEffect, useState } from 'react';
import type { CustomerInput } from '../api/customers-api';
import { ApiError, getUserFacingError } from '@/shared/api/http';

type Props = { initial?: Partial<CustomerInput>; submitting?: boolean; omitEmptyOptional?: boolean; onSubmit: (value: CustomerInput) => Promise<unknown>; onCancel: () => void };
type Errors = Partial<Record<keyof CustomerInput, string>>;

const inputClass = 'mt-2 w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

function digits(value: string, max: number) { return value.replace(/\D/g, '').slice(0, max); }
function formatDocument(value: string) {
  const raw = digits(value, 14);
  if (raw.length <= 11) return raw.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  return raw.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4').replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}
function formatPhone(value: string) {
  const raw = digits(value, 11);
  if (raw.length <= 2) return raw;
  if (raw.length <= 10) return raw.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^(\(\d{2}\) \d{4})(\d)/, '$1-$2');
  return raw.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^(\(\d{2}\) \d{5})(\d)/, '$1-$2');
}

export function CustomerForm({ initial, submitting, omitEmptyOptional = true, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState<CustomerInput>({ name: initial?.name ?? '', document: formatDocument(initial?.document ?? ''), phone: formatPhone(initial?.phone ?? ''), email: initial?.email ?? '', notes: initial?.notes ?? '' });
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function update(field: keyof CustomerInput, next: string) { setDirty(true); setValue((current) => ({ ...current, [field]: next })); setErrors((current) => ({ ...current, [field]: undefined })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Errors = {};
    if (!value.name.trim()) nextErrors.name = 'Informe o nome.';
    else if (value.name.length > 160) nextErrors.name = 'Use no máximo 160 caracteres.';
    const phoneDigits = digits(value.phone, 11); const documentDigits = digits(value.document, 14);
    if (!value.phone.trim()) nextErrors.phone = 'Informe o telefone.';
    else if (![10, 11].includes(phoneDigits.length)) nextErrors.phone = 'Informe um telefone brasileiro com DDD.';
    if (value.document && ![11, 14].includes(documentDigits.length)) nextErrors.document = 'Informe um CPF ou CNPJ válido.';
    if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) nextErrors.email = 'Informe um e-mail válido.';
    if (value.notes && (value.notes.length < 1 || value.notes.length > 2000)) nextErrors.notes = 'Use entre 1 e 2000 caracteres.';
    setErrors(nextErrors); setApiError(''); if (Object.keys(nextErrors).length) return;
    const normalized = { ...value, phone: phoneDigits, ...(value.document !== undefined ? { document: documentDigits } : {}) };
    const submitted = omitEmptyOptional ? Object.fromEntries(Object.entries(normalized).filter(([, field]) => field.trim() !== '')) as CustomerInput : normalized;
    try { await onSubmit(submitted); setDirty(false); }
    catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) setApiError('Já existe um cliente com este documento.');
      else if (error instanceof ApiError) {
        const fieldErrors = (error.problem as typeof error.problem & { errors?: unknown }).errors;
        if (fieldErrors && typeof fieldErrors === 'object') setErrors((current) => ({ ...current, ...Object.fromEntries(Object.entries(fieldErrors).filter(([field, message]) => field in value && typeof message === 'string')) as Errors }));
        setApiError(getUserFacingError(error.problem, 'Não foi possível salvar o cliente.'));
      }
      else setApiError('Não foi possível salvar o cliente agora.');
    }
  }
  return <form onSubmit={submit} className="space-y-6" noValidate>
    {apiError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div>}
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Nome" required error={errors.name}><input className={inputClass} autoFocus value={value.name} onChange={(e) => update('name', e.target.value)} aria-invalid={Boolean(errors.name)} /></Field>
      <Field label="Telefone" required error={errors.phone}><input className={inputClass} inputMode="tel" autoComplete="tel" value={value.phone} onChange={(e) => update('phone', formatPhone(e.target.value))} aria-invalid={Boolean(errors.phone)} /></Field>
      <Field label="CPF/CNPJ" error={errors.document}><input className={inputClass} inputMode="numeric" value={value.document} onChange={(e) => update('document', formatDocument(e.target.value))} aria-invalid={Boolean(errors.document)} /></Field>
      <Field label="E-mail" error={errors.email}><input className={inputClass} type="email" value={value.email} onChange={(e) => update('email', e.target.value)} aria-invalid={Boolean(errors.email)} /></Field>
      <Field label="Observações" error={errors.notes} className="items-start md:col-span-2"><textarea className={`${inputClass} min-h-32 resize-y`} rows={6} value={value.notes} onChange={(e) => update('notes', e.target.value)} aria-invalid={Boolean(errors.notes)} /></Field>
    </div>
    <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</button><button disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Salvando…' : 'Salvar cliente'}</button></div>
  </form>;
}

function Field({ label, required, error, className, children }: { label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode }) { return <label className={`block space-y-1.5 ${className ?? ''}`}><span className="block text-sm font-medium text-slate-700">{label}{required ? ' *' : ''}</span>{children}{error && <span className="block text-xs text-red-600">{error}</span>}</label>; }

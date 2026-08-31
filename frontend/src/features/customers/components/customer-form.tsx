import { FormEvent, useEffect, useState } from 'react';
import type { CustomerInput } from '../api/customers-api';
import { ApiError, getUserFacingError } from '@/shared/api/http';

type Props = { initial?: Partial<CustomerInput>; submitting?: boolean; omitEmptyOptional?: boolean; onSubmit: (value: CustomerInput) => Promise<unknown>; onCancel: () => void };
type Errors = Partial<Record<keyof CustomerInput, string>>;

function formatDocument(value: string) { return value.replace(/[^\d]/g, '').slice(0, 20); }
function formatPhone(value: string) { return value.replace(/[^\d()+\-\s]/g, '').slice(0, 30); }

export function CustomerForm({ initial, submitting, omitEmptyOptional = true, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState<CustomerInput>({ name: initial?.name ?? '', document: initial?.document ?? '', phone: initial?.phone ?? '', email: initial?.email ?? '', notes: initial?.notes ?? '' });
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
    if (!value.phone.trim()) nextErrors.phone = 'Informe o telefone.';
    else if (value.phone.length > 30) nextErrors.phone = 'Use no máximo 30 caracteres.';
    if (value.document && (value.document.length < 1 || value.document.length > 20)) nextErrors.document = 'Use entre 1 e 20 caracteres.';
    if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) nextErrors.email = 'Informe um e-mail válido.';
    if (value.notes && (value.notes.length < 1 || value.notes.length > 2000)) nextErrors.notes = 'Use entre 1 e 2000 caracteres.';
    setErrors(nextErrors); setApiError(''); if (Object.keys(nextErrors).length) return;
    const submitted = omitEmptyOptional ? Object.fromEntries(Object.entries(value).filter(([, field]) => field.trim() !== '')) as CustomerInput : value;
    try { await onSubmit(submitted); setDirty(false); }
    catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) setApiError('Já existe um Customer com este documento.');
      else if (error instanceof ApiError) {
        const fieldErrors = (error.problem as typeof error.problem & { errors?: unknown }).errors;
        if (fieldErrors && typeof fieldErrors === 'object') setErrors((current) => ({ ...current, ...Object.fromEntries(Object.entries(fieldErrors).filter(([field, message]) => field in value && typeof message === 'string')) as Errors }));
        setApiError(getUserFacingError(error.problem, 'Não foi possível salvar o Customer.'));
      }
      else setApiError('Não foi possível salvar o Customer agora.');
    }
  }
  return <form onSubmit={submit} className="space-y-6" noValidate>
    {apiError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div>}
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Nome" required error={errors.name}><input autoFocus value={value.name} onChange={(e) => update('name', e.target.value)} aria-invalid={Boolean(errors.name)} /></Field>
      <Field label="Telefone" required error={errors.phone}><input value={value.phone} onChange={(e) => update('phone', formatPhone(e.target.value))} aria-invalid={Boolean(errors.phone)} /></Field>
      <Field label="CPF/CNPJ" error={errors.document}><input value={value.document} onChange={(e) => update('document', formatDocument(e.target.value))} aria-invalid={Boolean(errors.document)} /></Field>
      <Field label="E-mail" error={errors.email}><input type="email" value={value.email} onChange={(e) => update('email', e.target.value)} aria-invalid={Boolean(errors.email)} /></Field>
      <Field label="Observações" error={errors.notes} className="md:col-span-2"><textarea rows={4} value={value.notes} onChange={(e) => update('notes', e.target.value)} aria-invalid={Boolean(errors.notes)} /></Field>
    </div>
    <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</button><button disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Salvando…' : 'Salvar Customer'}</button></div>
  </form>;
}

function Field({ label, required, error, className, children }: { label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode }) { return <label className={`block space-y-1.5 ${className ?? ''}`}><span className="text-sm font-medium text-slate-700">{label}{required ? ' *' : ''}</span>{children}{error && <span className="block text-xs text-red-600">{error}</span>}</label>; }

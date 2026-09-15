import { FormEvent, useState } from 'react';
import { ApiError, getUserFacingError } from '@/shared/api/http';
import type { InviteUserInput } from '../api/organization-users-api';

type Props = { submitting?: boolean; onSubmit: (input: InviteUserInput) => Promise<unknown> };

export function InviteUserForm({ submitting = false, onSubmit }: Props) {
  const [value, setValue] = useState<InviteUserInput>({ name: '', email: '' });
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = value.name.trim();
    const email = value.email.trim().toLowerCase();
    if (!name) return setError('Informe o nome.');
    if (name.length > 160) return setError('Use no máximo 160 caracteres.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Informe um e-mail válido.');
    setError('');
    try {
      await onSubmit({ name, email });
      setValue({ name: '', email: '' });
    } catch (error) {
      setError(error instanceof ApiError ? getUserFacingError(error.problem, 'Não foi possível enviar o convite agora.') : 'Não foi possível enviar o convite agora.');
    }
  }

  return <form onSubmit={submit} className="space-y-4" noValidate>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm font-medium text-slate-700"><span>Nome *</span><input aria-label="Nome do usuário" autoFocus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
      <label className="space-y-1 text-sm font-medium text-slate-700"><span>E-mail *</span><input aria-label="E-mail do usuário" type="email" value={value.email} onChange={(event) => setValue({ ...value, email: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
    </div>
    <button disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Enviando…' : 'Convidar administrador'}</button>
  </form>;
}

import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, getUserFacingError } from '@/shared/api/http';
import { confirmAccountCancellation, confirmRegistration, requestPasswordReset, resetPassword, resendConfirmation } from './api/public-registration-api';

function PublicFrame({ children }: { children: React.ReactNode }) {
  return <main className="public-simple-page"><div className="public-container max-w-2xl"><Link to="/" className="simple-link">← Voltar para o Vekar</Link>{children}</div></main>;
}

export function ConfirmRegistrationPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState('error'); return; }
    void confirmRegistration(token).then((response) => { setTrialEndsAt(response.data.trialEndsAt); setState('success'); }).catch(() => setState('error'));
  }, [params]);
  return <div className="public-site"><PublicFrame>{state === 'loading' && <p role="status" className="mt-8">Confirmando seu e-mail…</p>}{state === 'success' && <section className="mt-8 space-y-4"><p className="eyebrow dark">Cadastro confirmado</p><h1>Seu teste começou</h1><p>Você já pode entrar e organizar sua oficina. O Trial Period termina em <strong>{new Date(trialEndsAt).toLocaleString('pt-BR')}</strong>.</p><Link to="/login" className="simple-link">Entrar na oficina</Link></section>}{state === 'error' && <section className="mt-8 space-y-4"><h1>Não foi possível confirmar</h1><p>O link é inválido, expirou ou já foi utilizado.</p><Link to="/reenvio-confirmacao" className="simple-link">Solicitar novo link</Link></section>}</PublicFrame></div>;
}

export function ResendConfirmationPage() {
  const [email, setEmail] = useState(''); const [submitted, setSubmitted] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { await resendConfirmation(email); setSubmitted(true); } catch (cause) { setError(cause instanceof ApiError ? getUserFacingError(cause.problem, 'Não foi possível concluir a solicitação.') : 'Não foi possível concluir a solicitação.'); } }
  return <div className="public-site"><PublicFrame><h1 className="mt-8">Reenviar confirmação</h1>{submitted ? <p role="status" className="mt-4">Se houver um cadastro pendente, enviaremos um novo link para o e-mail informado.</p> : <form onSubmit={submit} className="mt-8 grid gap-5"><label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button type="submit" className="rounded-full bg-amber-400 px-5 py-3 font-bold text-slate-950">Enviar link</button></form>}</PublicFrame></div>;
}

export function PasswordRecoveryPage() {
  const [email, setEmail] = useState(''); const [submitted, setSubmitted] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); await requestPasswordReset(email); setSubmitted(true); }
  return <div className="public-site"><PublicFrame><h1 className="mt-8">Recuperar senha</h1>{submitted ? <p role="status" className="mt-4">Se houver uma conta compatível, enviaremos instruções para o e-mail informado.</p> : <form onSubmit={submit} className="mt-8 grid gap-5"><label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button type="submit" className="rounded-full bg-amber-400 px-5 py-3 font-bold text-slate-950">Enviar instruções</button></form>}</PublicFrame></div>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams(); const [password, setPassword] = useState(''); const [done, setDone] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { await resetPassword(params.get('token') ?? '', password); setDone(true); } catch (cause) { setError(cause instanceof ApiError ? getUserFacingError(cause.problem, 'O link é inválido ou expirou.') : 'O link é inválido ou expirou.'); } }
  return <div className="public-site"><PublicFrame><h1 className="mt-8">Criar nova senha</h1>{done ? <p role="status" className="mt-4">Senha atualizada. <Link to="/login" className="simple-link">Entrar agora</Link></p> : <form onSubmit={submit} className="mt-8 grid gap-5"><label>Nova senha<input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button type="submit" className="rounded-full bg-amber-400 px-5 py-3 font-bold text-slate-950">Atualizar senha</button></form>}</PublicFrame></div>;
}

export function ConfirmCancellationPage() {
  const [params] = useSearchParams(); const [state, setState] = useState<'loading' | 'success' | 'error'>('loading'); const [deadline, setDeadline] = useState('');
  useEffect(() => { const token = params.get('token'); if (!token) { setState('error'); return; } void confirmAccountCancellation(token).then((response) => { setDeadline(response.data.dataRetentionEndsAt); setState('success'); }).catch(() => setState('error')); }, [params]);
  return <div className="public-site"><PublicFrame>{state === 'loading' && <p role="status" className="mt-8">Confirmando o cancelamento…</p>}{state === 'success' && <section className="mt-8 space-y-4"><p className="eyebrow dark">Cancelamento confirmado</p><h1>Seu acesso continuará até o fim do período pago</h1><p>Depois disso, sua oficina terá acesso de consulta e exportação até <strong>{new Date(deadline).toLocaleString('pt-BR')}</strong>.</p><Link to="/login" className="simple-link">Voltar para o login</Link></section>}{state === 'error' && <section className="mt-8 space-y-4"><h1>Não foi possível confirmar</h1><p>O link é inválido, expirou ou o cancelamento já foi processado.</p><Link to="/" className="simple-link">Voltar para o Vekar</Link></section>}</PublicFrame></div>;
}

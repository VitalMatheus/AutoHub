import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, getUserFacingError } from '@/shared/api/http';
import { submitRegistration } from './api/public-registration-api';

const initial = { workshopName: '', document: '', phone: '', responsibleName: '', email: '', password: '', termsAccepted: false, privacyAccepted: false, marketingConsent: false };

export function RegistrationPage() {
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const update = (field: keyof typeof initial) => (event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try { await submitRegistration(form); setSubmitted(true); } catch (cause) {
      setError(cause instanceof ApiError ? getUserFacingError(cause.problem, 'Não foi possível concluir o cadastro. Tente novamente.') : 'Não foi possível concluir o cadastro. Tente novamente.');
    }
  }
  return <div className="public-site"><main className="public-simple-page"><div className="public-container max-w-2xl">
    <Link to="/" className="simple-link">← Voltar para o Vekar</Link>
    <p className="eyebrow dark mt-8">Teste grátis por 14 dias</p><h1>Comece pela sua oficina</h1>
    {submitted ? <div role="status" className="mt-8 rounded-2xl bg-emerald-50 p-6 text-emerald-900"><h2>Cadastro recebido</h2><p className="mt-2">Se os dados puderem iniciar um cadastro, enviaremos instruções para o e-mail informado.</p></div> : <form onSubmit={submit} className="mt-8 grid gap-5" noValidate>
      <label>Nome da oficina<input required name="workshopName" value={form.workshopName} onChange={update('workshopName')} /></label>
      <label>CPF ou CNPJ<input required name="document" inputMode="numeric" value={form.document} onChange={update('document')} /></label>
      <label>Telefone<input required name="phone" type="tel" value={form.phone} onChange={update('phone')} /></label>
      <label>Nome da pessoa responsável<input required name="responsibleName" value={form.responsibleName} onChange={update('responsibleName')} /></label>
      <label>E-mail<input required name="email" type="email" value={form.email} onChange={update('email')} /></label>
      <label>Senha<input required name="password" type="password" minLength={12} value={form.password} onChange={update('password')} /></label>
      <label className="flex items-start gap-3"><input required name="termsAccepted" type="checkbox" checked={form.termsAccepted} onChange={update('termsAccepted')} /><span>Aceito os <Link to="/termos" className="simple-link">Termos de Uso</Link>.</span></label>
      <label className="flex items-start gap-3"><input required name="privacyAccepted" type="checkbox" checked={form.privacyAccepted} onChange={update('privacyAccepted')} /><span>Aceito a <Link to="/privacidade" className="simple-link">Política de Privacidade</Link>.</span></label>
      <label className="flex items-start gap-3"><input name="marketingConsent" type="checkbox" checked={form.marketingConsent} onChange={update('marketingConsent')} /><span>Quero receber novidades e conteúdos do Vekar.</span></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button type="submit" className="inline-flex justify-center rounded-full bg-amber-400 px-5 py-3 font-bold text-slate-950">Criar cadastro</button>
    </form>}
  </div></main></div>;
}

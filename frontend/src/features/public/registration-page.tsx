import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, getUserFacingError } from '@/shared/api/http';
import { formatCpfCnpj, formatPhone } from '@/shared/forms/input-masks';
import { submitRegistration } from './api/public-registration-api';

const initial = { workshopName: '', document: '', phone: '', responsibleName: '', email: '', password: '', termsAccepted: false, privacyAccepted: false };

export function RegistrationPage() {
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const update = (field: keyof typeof initial) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    if (field === 'document' && typeof value === 'string') return setForm((current) => ({ ...current, document: formatCpfCnpj(value) }));
    if (field === 'phone' && typeof value === 'string') return setForm((current) => ({ ...current, phone: formatPhone(value) }));
    setForm((current) => ({ ...current, [field]: value }));
  };
  function validate(): string {
    if (!form.workshopName.trim()) return 'Informe o nome da oficina.';
    if (form.document.replace(/\D/g, '').length !== 11 && form.document.replace(/\D/g, '').length !== 14) return 'Informe um CPF ou CNPJ válido.';
    if (form.phone.replace(/\D/g, '').length < 10) return 'Informe um telefone válido da oficina.';
    if (!form.responsibleName.trim()) return 'Informe o nome da pessoa responsável.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Informe um e-mail válido.';
    if (form.password.length < 12) return 'A senha deve ter pelo menos 12 caracteres.';
    if (!form.termsAccepted) return 'Aceite os Termos de Uso para continuar.';
    if (!form.privacyAccepted) return 'Aceite a Política de Privacidade para continuar.';
    return '';
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    try { await submitRegistration(form); setSubmitted(true); } catch (cause) {
      setError(cause instanceof ApiError ? getUserFacingError(cause.problem, 'Não foi possível concluir o cadastro. Tente novamente.') : 'Não foi possível concluir o cadastro. Tente novamente.');
    }
  }
  return <div className="public-site"><main className="public-simple-page"><div className="public-container registration-layout">
    <div className="registration-intro">
      <Link to="/" className="simple-link">← Voltar para o Vekar</Link>
      <p className="eyebrow dark mt-8">Teste grátis por 14 dias</p><h1>Comece pela sua oficina</h1>
      <p className="simple-intro">Organize sua operação do orçamento ao pagamento. Crie seu acesso e conheça o Vekar sem compromisso.</p>
      <div className="registration-points" aria-label="Benefícios do teste grátis">
        <span><strong>14 dias</strong> para testar todos os recursos</span>
        <span><strong>Sem cartão</strong> e sem cobrança automática</span>
        <span><strong>Comece agora</strong> com os dados essenciais da oficina</span>
      </div>
    </div>
    {submitted ? <div role="status" className="registration-card registration-success"><h2>Cadastro recebido</h2><p>Se os dados puderem iniciar um cadastro, enviaremos instruções para o e-mail informado.</p></div> : <form onSubmit={submit} className="registration-card" noValidate>
      <div className="registration-card-heading"><h2>Crie seu acesso</h2><p>Preencha os dados abaixo para começar.</p></div>
      <div className="registration-fields">
        <label>Nome da oficina<input required name="workshopName" value={form.workshopName} onChange={update('workshopName')} /></label>
        <label>CPF ou CNPJ<input required name="document" inputMode="numeric" value={form.document} onChange={update('document')} /></label>
        <label>Telefone da oficina<input required name="phone" type="tel" inputMode="tel" value={form.phone} onChange={update('phone')} /></label>
        <label>Nome da pessoa responsável<input required name="responsibleName" value={form.responsibleName} onChange={update('responsibleName')} /></label>
        <label>E-mail de contato da oficina<input required name="email" type="email" value={form.email} onChange={update('email')} /><small>Será usado para o acesso da pessoa responsável.</small></label>
        <label>Senha<input aria-label="Senha" required name="password" type="password" minLength={12} value={form.password} onChange={update('password')} /><small>Mínimo de 12 caracteres.</small></label>
      </div>
      <div className="registration-consents">
        <label><input required name="termsAccepted" type="checkbox" checked={form.termsAccepted} onChange={update('termsAccepted')} /><span>Aceito os <Link to="/termos" className="legal-link">Termos de Uso</Link>.</span></label>
        <label><input required name="privacyAccepted" type="checkbox" checked={form.privacyAccepted} onChange={update('privacyAccepted')} /><span>Aceito a <Link to="/privacidade" className="legal-link">Política de Privacidade</Link>.</span></label>
      </div>
      {error && <p role="alert" className="registration-error">{error}</p>}
      <button type="submit" className="registration-submit">Criar cadastro <span aria-hidden="true">→</span></button>
      <p className="registration-privacy-note">Ao continuar, você receberá um e-mail para confirmar seu endereço.</p>
    </form>}
  </div></main></div>;
}

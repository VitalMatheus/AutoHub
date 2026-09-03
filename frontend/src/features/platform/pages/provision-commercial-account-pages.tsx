import { useState } from 'react';
import { ArrowLeft, Check, Copy, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  provisionOrganization,
  type ProvisionOrganizationInput,
  type ProvisionOrganizationResult,
} from '../api/organizations-api';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500';
type Form = {
  name: string;
  phone: string;
  adminName: string;
  adminEmail: string;
  contractedPrice: string;
  firstDueDate: string;
  document: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
};
const initialForm: Form = {
  name: '',
  phone: '',
  adminName: '',
  adminEmail: '',
  contractedPrice: '79.00',
  firstDueDate: '',
  document: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  notes: '',
};

export function ProvisionCommercialAccountPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(initialForm);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProvisionOrganizationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const update = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const required = [form.name, form.phone, form.adminName, form.adminEmail, form.contractedPrice, form.firstDueDate];
    if (required.some((value) => !value.trim()) || !/^\S+@\S+\.\S+$/.test(form.adminEmail)) {
      setError('Preencha os campos obrigatórios e informe um e-mail válido.');
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(form.contractedPrice) || Number(form.contractedPrice) <= 0) {
      setError('Informe um preço contratado válido.');
      return;
    }
    const billingDay = Number(form.firstDueDate.slice(8, 10));
    if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 28) {
      setError('O vencimento mensal deve ocorrer entre os dias 1 e 28.');
      return;
    }
    const optional = (value: string) => value.trim() || undefined;
    const payload: ProvisionOrganizationInput = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      admin: { name: form.adminName.trim(), email: form.adminEmail.trim() },
      contractedPrice: form.contractedPrice.trim(),
      firstDueDate: form.firstDueDate,
      billingDay,
      document: optional(form.document),
      addressLine1: optional(form.addressLine1),
      addressLine2: optional(form.addressLine2),
      city: optional(form.city),
      state: optional(form.state),
      postalCode: optional(form.postalCode),
      notes: optional(form.notes),
    };
    setSubmitting(true);
    setError('');
    try {
      setResult(await provisionOrganization(payload));
    } catch {
      setError('Não foi possível cadastrar a oficina. Revise os dados e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const leave = () => {
    if (result && !copied && !window.confirm('Se você sair agora, o segredo de ativação não poderá ser recuperado. Deseja sair?')) return;
    navigate('/platform/organizations');
  };

  if (result) {
    return <Success result={result} copied={copied} onCopy={async () => {
      await navigator.clipboard.writeText(result.activationSecret);
      setCopied(true);
    }} onLeave={leave} />;
  }

  return <section aria-labelledby="workshop-registration-title" className="mx-auto max-w-4xl space-y-6">
    <Link to="/platform/organizations" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700"><ArrowLeft size={16} />Voltar para oficinas</Link>
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Administração da plataforma</p>
      <h2 id="workshop-registration-title" className="mt-2 text-3xl font-bold tracking-tight">Cadastrar oficina</h2>
      <p className="mt-2 text-slate-600">Crie a oficina, seu administrador inicial e as condições comerciais em uma única operação.</p>
    </div>
    <form noValidate onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <fieldset>
        <legend className="text-lg font-semibold">Oficina</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field required label="Nome da oficina" value={form.name} onChange={(value) => update('name', value)} />
          <Field required label="Telefone da oficina" value={form.phone} onChange={(value) => update('phone', value)} />
          <Field label="Documento" value={form.document} onChange={(value) => update('document', value)} />
          <Field label="Endereço" value={form.addressLine1} onChange={(value) => update('addressLine1', value)} />
          <Field label="Complemento" value={form.addressLine2} onChange={(value) => update('addressLine2', value)} />
          <Field label="Cidade" value={form.city} onChange={(value) => update('city', value)} />
          <Field label="Estado" value={form.state} onChange={(value) => update('state', value)} />
          <Field label="CEP" value={form.postalCode} onChange={(value) => update('postalCode', value)} />
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Observações<textarea aria-label="Observações" className={`${inputClass} mt-1 min-h-24`} value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
      </fieldset>
      <fieldset>
        <legend className="text-lg font-semibold">Administrador inicial</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field required label="Nome do administrador" value={form.adminName} onChange={(value) => update('adminName', value)} />
          <Field required type="email" label="E-mail do administrador" value={form.adminEmail} onChange={(value) => update('adminEmail', value)} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-lg font-semibold">Condições comerciais</legend>
        <p className="mt-1 text-sm text-slate-500">O primeiro vencimento inicia o ciclo mensal; não existe período de teste separado.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field required inputMode="decimal" label="Preço contratado" value={form.contractedPrice} onChange={(value) => update('contractedPrice', value)} />
          <Field required type="date" label="Primeiro vencimento" value={form.firstDueDate} onChange={(value) => update('firstDueDate', value)} />
        </div>
      </fieldset>
      <div className="flex justify-end"><button type="submit" disabled={submitting} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Cadastrando…' : 'Cadastrar oficina'}</button></div>
    </form>
  </section>;
}

function Field({ label, value, onChange, required, type = 'text', inputMode }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input required={required} aria-label={label} type={type} inputMode={inputMode} className={`${inputClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Success({ result, copied, onCopy, onLeave }: { result: ProvisionOrganizationResult; copied: boolean; onCopy: () => Promise<void>; onLeave: () => void }) {
  return <section aria-labelledby="registration-success-title" className="mx-auto max-w-2xl space-y-6">
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><Check className="text-emerald-700" size={28} /><h2 id="registration-success-title" className="mt-3 text-2xl font-bold text-emerald-950">Oficina cadastrada</h2><p className="mt-2 text-sm text-emerald-900">{result.organization.name} e o administrador {result.admin.email} foram criados.</p></div>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><div className="flex gap-3"><ShieldAlert className="shrink-0 text-amber-700" size={22} /><div className="min-w-0 flex-1"><h3 className="font-semibold text-amber-950">Segredo de ativação</h3><p className="mt-1 text-sm text-amber-900">Copie agora. Por segurança, ele só fica disponível nesta resposta.</p><input readOnly aria-label="Segredo de ativação" value={result.activationSecret} className={`${inputClass} mt-4 font-mono`} /><button type="button" onClick={() => void onCopy()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white"><Copy size={16} />{copied ? 'Segredo copiado.' : 'Copiar segredo'}</button></div></div></div>
    <button type="button" onClick={onLeave} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Voltar para oficinas</button>
  </section>;
}

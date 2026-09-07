import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ApiError } from '@/shared/api/http';
import { getHomePath, useAuth } from '../auth-context';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, isSigningIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    try {
      const signedInPrincipal = await signIn(email, password);
      navigate(getHomePath(signedInPrincipal.role), { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Não foi possível entrar agora.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Vekar</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Entrar na oficina</h1>
          <p className="mt-2 text-sm text-slate-600">Acesse a operação da sua Organization.</p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            E-mail
            <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          <Link to="/recuperar-senha" className="text-sm font-semibold text-blue-700">Esqueci minha senha</Link>
          <label className="block text-sm font-medium text-slate-700">
            Senha
            <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </label>
          {errorMessage && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
          <button className="w-full rounded-md bg-blue-700 px-4 py-2.5 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSigningIn}>
            {isSigningIn ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';

export function PlatformLayout() {
  const { principal, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">AutoHub</p>
            <p className="text-xs text-slate-500">Administração da plataforma</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-600">Olá, {principal?.name}</p>
            <button type="button" onClick={() => void signOut()} className="text-sm font-medium text-violet-700 hover:text-violet-900">Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Outlet /></main>
    </div>
  );
}

import { BarChart3, Clock3 } from 'lucide-react';

export function ReportsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">Acompanhe os resultados da sua oficina.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="reports-unavailable-title">
        <div className="flex flex-col items-start gap-5 sm:flex-row">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <BarChart3 size={24} aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="reports-unavailable-title" className="text-xl font-semibold text-slate-900">Relatórios em breve</h2>
              <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <Clock3 size={14} aria-hidden="true" /> Indisponível
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Ainda não há dados consolidados disponíveis para gerar relatórios no AutoHub.
              Esta área será liberada quando houver uma fonte de dados própria para esse fim.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">O que ainda não está disponível</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Métricas, receitas, atividades e indicadores não são exibidos aqui porque ainda não
            existe um endpoint de relatórios agregado no backend.
          </p>
        </div>
      </section>
    </div>
  );
}

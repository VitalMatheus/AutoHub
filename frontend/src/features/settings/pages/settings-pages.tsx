import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/http';
import { InviteUserForm } from '../components/invite-user-form';
import { activateOrganizationUser, deactivateOrganizationUser, inviteOrganizationUser, listOrganizationUsers, revokeOrganizationUserSessions, type OrganizationUser } from '../api/organization-users-api';

const statusLabels = { PENDING_ACTIVATION: 'Convite pendente', ACTIVE: 'Ativo', DISABLED: 'Desativado' } as const;
const safeError = (error: unknown, fallback: string) => error instanceof ApiError && error.problem.status === 403 ? 'Você não tem permissão para administrar estes usuários.' : fallback;

export function SettingsPage() {
  const client = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const users = useQuery({ queryKey: ['organization-users'], queryFn: listOrganizationUsers, retry: false });
  const invite = useMutation({ mutationFn: inviteOrganizationUser, onSuccess: async (result) => { await client.invalidateQueries({ queryKey: ['organization-users'] }); setFeedback({ kind: 'success', message: `Convite criado para ${result.user.email}. Token de ativação (exiba apenas uma vez): ${result.activationToken}` }); }, onError: (error) => setFeedback({ kind: 'error', message: safeError(error, 'Não foi possível enviar o convite agora.') }) });
  const action = useMutation<OrganizationUser | { success: true }, unknown, { id: string; type: 'activate' | 'deactivate' | 'revoke' }>({ mutationFn: ({ id, type }) => type === 'activate' ? activateOrganizationUser(id) : type === 'deactivate' ? deactivateOrganizationUser(id) : revokeOrganizationUserSessions(id), onSuccess: async (_, variables) => { await client.invalidateQueries({ queryKey: ['organization-users'] }); setFeedback({ kind: 'success', message: variables.type === 'revoke' ? 'Sessões revogadas com sucesso.' : `Usuário ${variables.type === 'activate' ? 'ativado' : 'desativado'} com sucesso.` }); }, onError: (error) => setFeedback({ kind: 'error', message: safeError(error, 'Não foi possível concluir a ação agora.') }) });

  function runAction(user: OrganizationUser, type: 'activate' | 'deactivate' | 'revoke') {
    if (type === 'revoke' && !window.confirm(`Revogar todas as sessões de ${user.name}?`)) return;
    setFeedback(null);
    action.mutate({ id: user.id, type });
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <header><h1 className="text-2xl font-bold tracking-tight text-slate-950">Configurações</h1><p className="mt-1 text-sm text-slate-500">Administre os usuários da sua Organization.</p></header>
    {feedback && <div role="alert" className={`rounded-xl border p-3 text-sm ${feedback.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{feedback.message}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-4 text-lg font-semibold text-slate-900">Convidar Organization Admin</h2><InviteUserForm submitting={invite.isPending} onSubmit={(input) => invite.mutateAsync(input)} /></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-4 text-lg font-semibold text-slate-900">Usuários da Organization</h2>{users.isPending ? <div role="status">Carregando usuários…</div> : users.isError ? <div role="alert" className="text-sm text-red-700">Não foi possível carregar os usuários. <button className="font-semibold underline" onClick={() => void users.refetch()}>Tentar novamente</button></div> : users.data.length === 0 ? <p className="text-sm text-slate-500">Nenhum usuário encontrado.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Nome</th><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">Perfil</th><th className="px-3 py-3">Situação</th><th className="px-3 py-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{users.data.map((user) => <tr key={user.id}><td className="px-3 py-4 font-medium text-slate-900">{user.name}</td><td className="px-3 py-4">{user.email}</td><td className="px-3 py-4">Organization Admin</td><td className="px-3 py-4">{statusLabels[user.status]}</td><td className="space-x-3 px-3 py-4"><button disabled={action.isPending || user.status === 'ACTIVE'} onClick={() => runAction(user, 'activate')} className="font-semibold text-blue-700 disabled:opacity-40">Ativar</button><button disabled={action.isPending || user.status === 'DISABLED'} onClick={() => runAction(user, 'deactivate')} className="font-semibold text-blue-700 disabled:opacity-40">Desativar</button><button disabled={action.isPending} onClick={() => runAction(user, 'revoke')} className="font-semibold text-red-700 disabled:opacity-40">Revogar sessões</button></td></tr>)}</tbody></table></div>}</section>
  </div>;
}

export function formatPlatformDate(value: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Recife' }).format(new Date(value));
}

export function formatPlatformMoney(value: string): string {
  const trimmed = value.trim();
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(normalized));
}

const labels: Record<string, string> = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', DISABLED: 'Desativado', PENDING: 'Pendente',
  PENDING_ACTIVATION: 'Aguardando ativação', DELINQUENT: 'Inadimplente', CANCELLED: 'Cancelado',
};
export function formatPlatformStatus(status: string): string { return labels[status] ?? status.replaceAll('_', ' ').toLowerCase(); }

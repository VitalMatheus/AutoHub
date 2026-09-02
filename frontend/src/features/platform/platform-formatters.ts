import { formatMoney } from '@/features/shared/money';

export function formatPlatformDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Recife' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')}`;
}

export function formatPlatformTimestamp(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Recife' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

export function formatPlatformMoney(value: string): string {
  return formatMoney(value);
}

const labels: Record<string, string> = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', DISABLED: 'Desativado', PENDING: 'Pendente',
  PENDING_ACTIVATION: 'Aguardando ativação', DELINQUENT: 'Inadimplente', CANCELLED: 'Cancelado',
};
export function formatPlatformStatus(status: string): string { return labels[status] ?? `Desconhecido (${status})`; }

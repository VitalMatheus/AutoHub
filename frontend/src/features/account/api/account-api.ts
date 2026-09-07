import { httpClient } from '@/shared/api/http';

export type AccountAccessStatus = {
  commercialAccess: string;
  nextDueDate: string | null;
  blockDate: string | null;
  remainingDays: number | null;
  instruction: string;
  cancellation: { effectiveAt: string; retentionEndsAt: string | null; finalizedAt: string | null } | null;
};

export function fetchAccountAccessStatus() {
  return httpClient.get<AccountAccessStatus>('/account/access-status').then((response) => response.data);
}

export function requestAccountCancellation(password: string) {
  return httpClient.post<{ message: string }>('/account/cancellation/request', { password });
}

export function confirmAccountCancellation(token: string) {
  return httpClient.post<{ success: true; effectiveCancellationAt: string; dataRetentionEndsAt: string; exportPath: string }>('/account/cancellation/confirm', { token });
}

export async function downloadCustomerExport() {
  const response = await httpClient.get<Blob>('/exports/customers.csv', { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'vekar-customers.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

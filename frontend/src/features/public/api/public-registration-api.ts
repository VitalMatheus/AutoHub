import { httpClient } from '@/shared/api/http';

export type RegistrationInput = {
  workshopName: string;
  document: string;
  phone: string;
  responsibleName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export function submitRegistration(input: RegistrationInput) {
  return httpClient.post<{ message: string }>('/public/registrations', input);
}

export function confirmRegistration(token: string) {
  return httpClient.post<{ success: true; trialStartsAt: string; trialEndsAt: string }>(`/public/registrations/confirm?token=${encodeURIComponent(token)}`);
}

export function resendConfirmation(email: string) {
  return httpClient.post<{ message: string }>('/public/registrations/confirmation/resend', { email });
}

export function requestPasswordReset(email: string) {
  return httpClient.post<{ message: string }>('/auth/password-reset/request', { email });
}

export function resetPassword(token: string, password: string) {
  return httpClient.post<{ success: true }>('/auth/password-reset/confirm', { token, password });
}

export function confirmAccountCancellation(token: string) {
  return httpClient.post<{ success: true; effectiveCancellationAt: string; dataRetentionEndsAt: string; exportPath: string }>('/account/cancellation/confirm', { token });
}

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
  marketingConsent?: boolean;
};

export function submitRegistration(input: RegistrationInput) {
  return httpClient.post<{ message: string }>('/public/registrations', input);
}

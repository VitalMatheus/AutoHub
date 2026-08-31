import { httpClient } from '@/shared/api/http';

export type OrganizationUserStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'DISABLED';

export type OrganizationUser = {
  id: string;
  name: string;
  email: string;
  status: OrganizationUserStatus;
  createdAt: string;
  updatedAt: string;
};

export type InviteUserInput = { name: string; email: string };
export type InviteUserResult = { user: OrganizationUser; activationToken: string };

export async function listOrganizationUsers(): Promise<OrganizationUser[]> {
  const response = await httpClient.get<OrganizationUser[]>('/organizations/users');
  return response.data;
}

export async function inviteOrganizationUser(input: InviteUserInput): Promise<InviteUserResult> {
  const response = await httpClient.post<InviteUserResult>('/organizations/users', input);
  return response.data;
}

export async function activateOrganizationUser(id: string): Promise<OrganizationUser> {
  const response = await httpClient.post<OrganizationUser>(`/organizations/users/${id}/activate`);
  return response.data;
}

export async function deactivateOrganizationUser(id: string): Promise<OrganizationUser> {
  const response = await httpClient.post<OrganizationUser>(`/organizations/users/${id}/deactivate`);
  return response.data;
}

export async function revokeOrganizationUserSessions(id: string): Promise<{ success: true }> {
  const response = await httpClient.post<{ success: true }>(`/organizations/users/${id}/revoke-sessions`);
  return response.data;
}

import { httpClient } from '@/shared/api/http';

export type Customer = {
  id: string;
  organizationId: string;
  name: string;
  document: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerListParams = {
  page: number;
  pageSize: number;
  search?: string;
  active?: boolean;
  sort: 'createdAt' | 'name' | 'updatedAt';
  direction: 'asc' | 'desc';
};

export type CustomerList = { data: Customer[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type CustomerInput = { name: string; document?: string; phone: string; email?: string; notes?: string };

export async function listCustomers(params: CustomerListParams): Promise<CustomerList> {
  const response = await httpClient.get<CustomerList>('/customers', { params });
  return response.data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const response = await httpClient.get<Customer>(`/customers/${id}`);
  return response.data;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const response = await httpClient.post<Customer>('/customers', input);
  return response.data;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  const response = await httpClient.patch<Customer>(`/customers/${id}`, input);
  return response.data;
}

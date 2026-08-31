import { httpClient } from '@/shared/api/http';

export type Service = { id: string; name: string; description: string | null; price: string; active: boolean; createdAt: string; updatedAt: string };
export type ServiceListParams = { page: number; pageSize: number; search?: string; active?: boolean; sort: 'createdAt' | 'name' | 'price' | 'updatedAt'; direction: 'asc' | 'desc' };
export type ServiceList = { data: Service[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type ServiceInput = { name: string; description?: string; price: string };

export const listServices = (params: ServiceListParams) => httpClient.get<ServiceList>('/services', { params }).then((response) => response.data);
export const getService = (id: string) => httpClient.get<Service>(`/services/${id}`).then((response) => response.data);
export const createService = (input: ServiceInput) => httpClient.post<Service>('/services', input).then((response) => response.data);
export const updateService = (id: string, input: Partial<ServiceInput>) => httpClient.patch<Service>(`/services/${id}`, input).then((response) => response.data);
export const serviceAction = (id: string, action: 'activate' | 'deactivate') => httpClient.post<Service>(`/services/${id}/${action}`).then((response) => response.data);

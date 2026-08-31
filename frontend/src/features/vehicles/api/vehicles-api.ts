import { httpClient } from '@/shared/api/http';

export type Vehicle = {
  id: string; organizationId: string; customerId: string; plate: string; brand: string; model: string;
  year: number | null; color: string | null; mileage: number | null; notes: string | null; active: boolean;
  createdAt: string; updatedAt: string;
};
export type VehicleListParams = { page: number; pageSize: number; customerId?: string; plate?: string; active?: boolean; sort: 'createdAt' | 'plate' | 'brand' | 'model' | 'year' | 'mileage' | 'updatedAt'; direction: 'asc' | 'desc' };
export type VehicleList = { data: Vehicle[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type VehicleInput = { customerId: string; plate: string; brand: string; model: string; year?: number; color?: string; mileage?: number; notes?: string };
export async function listVehicles(params: VehicleListParams): Promise<VehicleList> { return (await httpClient.get<VehicleList>('/vehicles', { params })).data; }
export async function getVehicle(id: string): Promise<Vehicle> { return (await httpClient.get<Vehicle>(`/vehicles/${id}`)).data; }
export async function createVehicle(input: VehicleInput): Promise<Vehicle> { return (await httpClient.post<Vehicle>('/vehicles', input)).data; }
export async function updateVehicle(id: string, input: Partial<VehicleInput>): Promise<Vehicle> { return (await httpClient.patch<Vehicle>(`/vehicles/${id}`, input)).data; }
